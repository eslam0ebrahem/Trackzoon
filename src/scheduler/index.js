import cron from 'node-cron';
import { PriceTrackerService } from '../services/priceTrackerService.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import Subscription from '../models/Subscription.js';
import { buildDailyReportMessage } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';
import { captureError, captureMessage } from '../config/sentry.js';

// Store active cron tasks for cleanup
let activeTasks = [];

const startScheduler = (bot) => {
  const priceTracker = new PriceTrackerService(bot);
  let isChecking = false;

  const runPriceCheck = async () => {
    if (isChecking) {
      console.log('Previous price check still running, skipping...');
      return;
    }

    isChecking = true;
    console.log('Starting scheduled price check...');
    const startTime = Date.now();

    try {
      const results = await priceTracker.checkAllPrices();
      const duration = (Date.now() - startTime) / 1000;

      console.log(`Price check processing:
          - ${results.queued} products queued for background checking`);

      // Log to Sentry if too many failures
      if (results.failed > results.succeeded && results.failed > 5) {
        captureMessage(
          `High failure rate in price check: ${results.failed} failures vs ${results.succeeded} successes`,
          'warning',
          { results }
        );
      }
    } catch (error) {
      console.error('Error in scheduled price check:', error);
      captureError(error, { operation: 'scheduled_price_check' });
    } finally {
      isChecking = false;
    }
  };

  const sendDailyReports = async () => {
    console.log('Starting daily report generation...');
    const startTime = Date.now();

    try {
      // Find all users with daily reports enabled
      const users = await User.find({ 'settings.dailyReport': true });
      console.log(`Sending daily reports to ${users.length} users...`);

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
          // It expects a 'trackedBy' array on the product with thresholdPrice
          const products = subscriptions
            .filter(sub => sub.product) // Safety check for deleted products
            .map(sub => {
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
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`Failed to send daily report to user ${user.telegramId}:`, error.message);
          failed++;
        }
      }

      const duration = (Date.now() - startTime) / 1000;
      console.log(`Daily reports completed in ${duration.toFixed(1)}s:
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
      console.error('Error in daily report generation:', error);
      captureError(error, { operation: 'daily_report_generation' });
    }
  };

  // Create and store cron tasks
  const priceCheckTask = cron.schedule('0,30 * * * *', runPriceCheck);
  const dailyReportTask = cron.schedule('0 8 * * *', sendDailyReports);

  // Store tasks for cleanup
  activeTasks.push(priceCheckTask, dailyReportTask);

  // Run initial check after 1 minute
  setTimeout(runPriceCheck, 60 * 1000);

  console.log('Scheduler started:');
  console.log('- Price checks: Every 30 minutes');
  console.log('- Daily reports: Every day at 8:00 AM');

  // Return cleanup function
  return () => {
    console.log('Stopping scheduler...');
    activeTasks.forEach(task => {
      if (task && task.stop) {
        task.stop();
      }
    });
    activeTasks = [];
    console.log('Scheduler stopped');
  };
};

export default startScheduler;