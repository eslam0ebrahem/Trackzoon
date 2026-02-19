import cron from 'node-cron';
import { PriceTrackerService } from '../services/priceTrackerService.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { buildDailyReportMessage } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';
import { captureError, captureMessage } from '../config/sentry.js';
import AlertDigestService from '../services/alertDigestService.js';
import SystemMetric from '../models/SystemMetric.js';
import { logger } from '../utils/logger.js';

// Store active cron tasks for cleanup
let activeTasks = [];
let schedulerGuardTimer = null;
let initialRunTimer = null;

const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'UTC';
const LATE_RUN_TOLERANCE_MS = Math.max(30000, Number(process.env.SCHEDULER_LATE_TOLERANCE_MS || 120000));
const PRICE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const DAILY_REPORT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ALERT_DIGEST_INTERVAL_MS = 5 * 60 * 1000;
const GUARD_INTERVAL_MS = 2 * 60 * 1000;

const recordSchedulerMetric = async ({
  task,
  status,
  durationMs,
  lateByMs = 0,
  error = null
}) => {
  try {
    await SystemMetric.create({
      type: 'system',
      data: {
        component: 'scheduler',
        task,
        status,
        durationMs,
        lateByMs,
        error
      }
    });
  } catch {
    // Metrics are best-effort; scheduler should never crash on telemetry write failures.
  }
};

const startScheduler = (bot) => {
  const priceTracker = new PriceTrackerService(bot);
  const digestService = new AlertDigestService(bot);
  const startedAt = Date.now();

  const taskState = {
    priceCheck: { running: false, lastStartAt: null },
    dailyReports: { running: false, lastStartAt: null },
    alertDigest: { running: false, lastStartAt: null }
  };

  const wrapTask = (taskName, expectedIntervalMs, fn) => async () => {
    const state = taskState[taskName];
    const now = Date.now();
    let lateByMs = 0;

    if (state.running) {
      logger.warn(`[Scheduler] ${taskName} is already running, skipping overlapping trigger.`);
      return;
    }

    if (state.lastStartAt) {
      const gap = now - state.lastStartAt;
      lateByMs = Math.max(0, gap - expectedIntervalMs);
      if (lateByMs > LATE_RUN_TOLERANCE_MS) {
        logger.warn(`[Scheduler] ${taskName} trigger drift detected (${lateByMs}ms late).`);
      }
    }

    state.running = true;
    state.lastStartAt = now;
    const runStartedAt = Date.now();

    try {
      await fn();
      await recordSchedulerMetric({
        task: taskName,
        status: 'ok',
        durationMs: Date.now() - runStartedAt,
        lateByMs
      });
    } catch (error) {
      await recordSchedulerMetric({
        task: taskName,
        status: 'error',
        durationMs: Date.now() - runStartedAt,
        lateByMs,
        error: error.message
      });
      throw error;
    } finally {
      state.running = false;
    }
  };

  const runPriceCheck = wrapTask('priceCheck', PRICE_CHECK_INTERVAL_MS, async () => {
    logger.info('Starting scheduled price check...');
    const startTime = Date.now();

    try {
      const results = await priceTracker.checkAllPrices();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);

      logger.info(
        `Price check processing:
          - ${results.queued} products queued for background checking
          - duration: ${duration}s`
      );

      // Log to Sentry if too many failures
      if (results.failed > results.succeeded && results.failed > 5) {
        captureMessage(
          `High failure rate in price check: ${results.failed} failures vs ${results.succeeded} successes`,
          'warning',
          { results }
        );
      }
    } catch (error) {
      logger.error('Error in scheduled price check:', error);
      captureError(error, { operation: 'scheduled_price_check' });
      throw error;
    }
  });

  const sendDailyReports = wrapTask('dailyReports', DAILY_REPORT_INTERVAL_MS, async () => {
    logger.info('Starting daily report generation...');
    const startTime = Date.now();

    try {
      // Find all users with daily reports enabled
      const users = await User.find({ 'settings.dailyReport': true });
      logger.info(`Sending daily reports to ${users.length} users...`);

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      for (const user of users) {
        try {
          // Get user's subscriptions with full product details
          const subscriptions = await Subscription.find({ user: user._id }).populate('product');

          if (subscriptions.length === 0) {
            skipped++;
            continue; // Skip users with no subscriptions
          }

          // Map subscriptions to the format expected by buildDailyReportMessage
          // It expects a 'trackedBy' array on the product with thresholdPrice.
          const products = subscriptions
            .filter((sub) => sub.product) // Safety check for deleted products
            .map((sub) => {
              const productObj = sub.product.toObject();
              return {
                ...productObj,
                trackedBy: [{
                  chatId: user.telegramId,
                  thresholdPrice: sub.targetPrice
                }]
              };
            });

          if (products.length === 0) {
            skipped++;
            continue;
          }

          // Build and send report
          const reportMessage = buildDailyReportMessage(
            products,
            user.firstName || user.username || 'there'
          );

          await sendMessageWithRetry(bot, user.telegramId, reportMessage, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📋 View All Products', callback_data: 'list_products' },
                  { text: '🔥 Hot Deals', callback_data: 'show_deals' }
                ],
                [
                  { text: '➕ Track New Product', callback_data: 'add_product' },
                  { text: '⚙️ Settings', callback_data: 'settings' }
                ]
              ]
            }
          });

          sent++;

          // Add small delay to avoid rate limiting
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          logger.warn(`Failed to send daily report to user ${user.telegramId}: ${error.message}`);
          failed++;
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`Daily reports completed in ${duration}s:
          - ${sent} reports sent successfully
          - ${skipped} users skipped (no products)
          - ${failed} failed to send`);

      // Log to Sentry if too many failures
      if (failed > sent && failed > 3) {
        captureMessage(
          `High failure rate in daily reports: ${failed} failures vs ${sent} successes`,
          'warning',
          { sent, failed, skipped }
        );
      }
    } catch (error) {
      logger.error('Error in daily report generation:', error);
      captureError(error, { operation: 'daily_report_generation' });
      throw error;
    }
  });

  const flushAlertDigests = wrapTask('alertDigest', ALERT_DIGEST_INTERVAL_MS, async () => {
    try {
      await digestService.flushDueDigests();
    } catch (error) {
      logger.error('Error flushing alert digests:', error);
      captureError(error, { operation: 'alert_digest_flush' });
      throw error;
    }
  });

  const cronOptions = {
    timezone: SCHEDULER_TIMEZONE,
    noOverlap: true
  };

  // Create and store cron tasks
  const priceCheckTask = cron.schedule('0 * * * *', runPriceCheck, cronOptions);
  const dailyReportTask = cron.schedule('0 8 * * *', sendDailyReports, cronOptions);
  const digestTask = cron.schedule('*/5 * * * *', flushAlertDigests, cronOptions);

  // Store tasks for cleanup
  activeTasks.push(priceCheckTask, dailyReportTask, digestTask);

  // Run initial check after 1 minute
  initialRunTimer = setTimeout(() => {
    runPriceCheck().catch((error) => {
      logger.error(`Initial price check failed: ${error.message}`);
    });
  }, 60 * 1000);
  initialRunTimer.unref?.();

  // Guard timer recovers from missed cron ticks when event loop is blocked for long periods.
  schedulerGuardTimer = setInterval(() => {
    const now = Date.now();

    const priceState = taskState.priceCheck;
    const digestState = taskState.alertDigest;

    const priceBaseline = priceState.lastStartAt || startedAt;
    const digestBaseline = digestState.lastStartAt || startedAt;

    if (!priceState.running && now - priceBaseline > PRICE_CHECK_INTERVAL_MS + LATE_RUN_TOLERANCE_MS) {
      logger.warn('[Scheduler] Price check appears overdue. Triggering recovery run.');
      runPriceCheck().catch((error) => {
        logger.error(`Recovered price check failed: ${error.message}`);
      });
    }

    if (!digestState.running && now - digestBaseline > ALERT_DIGEST_INTERVAL_MS + LATE_RUN_TOLERANCE_MS) {
      logger.warn('[Scheduler] Alert digest flush appears overdue. Triggering recovery run.');
      flushAlertDigests().catch((error) => {
        logger.error(`Recovered digest flush failed: ${error.message}`);
      });
    }
  }, GUARD_INTERVAL_MS);
  schedulerGuardTimer.unref?.();

  logger.info('Scheduler started:');
  logger.info('- Price checks: Every hour');
  logger.info('- Daily reports: Every day at 8:00 AM');
  logger.info('- Alert digests: Every 5 minutes');
  logger.info(`- Timezone: ${SCHEDULER_TIMEZONE}`);

  // Return cleanup function
  return () => {
    logger.info('Stopping scheduler...');
    activeTasks.forEach((task) => {
      if (task && task.stop) {
        task.stop();
      }
    });
    activeTasks = [];

    if (schedulerGuardTimer) {
      clearInterval(schedulerGuardTimer);
      schedulerGuardTimer = null;
    }

    if (initialRunTimer) {
      clearTimeout(initialRunTimer);
      initialRunTimer = null;
    }

    logger.info('Scheduler stopped');
  };
};

export default startScheduler;
