import 'dotenv/config';
import crypto from 'crypto';
import { initSentry, captureError } from './config/sentry.js';
import { logger } from './utils/logger.js';
import cache from './config/cache.js';
import connectDB from './config/db.js';
import commands from './config/commands.js';
import initializeBot from './core/bot.js';
import registerHandlers from './handlers.js';
import startScheduler from './scheduler/index.js';
import { attachUser, attachState, errorHandler, timeoutHandler } from './middleware/index.js';
import { stateManager } from './utils/stateManager.js';
import { escapeMarkdownV2 } from './utils/messageHelper.js';
import { mainKeyboard } from './utils/keyboards/mainKeyboard.js';
import { startServer } from './server.js';
import { startKeepAlive } from './services/keepAliveService.js';
import { createWorker } from './queue/priceQueue.js'; // Import Worker Factory

const BOT_LOCK_KEY = process.env.BOT_LOCK_KEY || 'trackzoon:bot:polling-lock';
const BOT_LOCK_TTL_MS = Number(process.env.BOT_LOCK_TTL_MS || 60000);
const BOT_LOCK_RENEW_MS = Math.max(5000, Math.floor(BOT_LOCK_TTL_MS / 2));
const BOT_INSTANCE_ID = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

let botLockRedis = null;
let botLockRenewTimer = null;
let botLaunchEnabled = true;

const acquireBotLock = async () => {
  const redis = cache.getClient();
  if (!redis || !cache.isEnabled()) {
    logger.warn('Redis not available; starting bot without distributed lock.');
    return true;
  }

  botLockRedis = redis;
  const result = await redis.set(BOT_LOCK_KEY, BOT_INSTANCE_ID, 'PX', BOT_LOCK_TTL_MS, 'NX');
  if (result !== 'OK') {
    return false;
  }

  botLockRenewTimer = setInterval(async () => {
    try {
      const owner = await redis.get(BOT_LOCK_KEY);
      if (owner !== BOT_INSTANCE_ID) {
        logger.warn('Lost bot lock ownership. Stopping polling to avoid conflicts.');
        clearInterval(botLockRenewTimer);
        botLockRenewTimer = null;
        bot.stop('SIGTERM');
        return;
      }
      await redis.set(BOT_LOCK_KEY, BOT_INSTANCE_ID, 'PX', BOT_LOCK_TTL_MS);
    } catch (error) {
      logger.warn(`Failed to renew bot lock: ${error.message}`);
    }
  }, BOT_LOCK_RENEW_MS);

  return true;
};

const releaseBotLock = async () => {
  if (botLockRenewTimer) {
    clearInterval(botLockRenewTimer);
    botLockRenewTimer = null;
  }
  if (!botLockRedis) return;
  try {
    const owner = await botLockRedis.get(BOT_LOCK_KEY);
    if (owner === BOT_INSTANCE_ID) {
      await botLockRedis.del(BOT_LOCK_KEY);
    }
  } catch (error) {
    logger.warn(`Failed to release bot lock: ${error.message}`);
  }
};

// Initialize Sentry error monitoring first
initSentry();

// Initialize Redis cache (optional)
cache.init();

// Connect to MongoDB
await connectDB();

// Initialize the bot
const bot = initializeBot(commands);

// Register global middleware
bot.use(errorHandler);
bot.use(timeoutHandler);
bot.use(attachUser);
bot.use(attachState);

// Register command and action handlers
registerHandlers(bot);

// Start the scheduler and store cleanup function
const stopScheduler = startScheduler(bot);

// Handle state timeouts
stateManager.on('stateTimeout', async ({ chatId, state }) => {
  try {
    await bot.telegram.sendMessage(
      chatId,
      escapeMarkdownV2('⏰ Your session has timed out\\. Please use the menu to start over\\.'),
      {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      }
    );
  } catch (error) {
    console.error('Error sending timeout message:', error);
  }
});

// Set bot commands menu for Telegram
bot.telegram.setMyCommands([
  { command: 'start', description: 'Start the bot' },
  { command: 'help', description: 'Show help and commands' },
  { command: 'add', description: 'Track a new product' },
  { command: 'add_percentage', description: 'Track by % drop' },
  { command: 'list', description: 'View your tracked products' },
  { command: 'deals', description: 'See top 5 price drops (24h)' },
  { command: 'report', description: 'Get your daily price report' },
  { command: 'chart', description: 'View price history chart' },
  { command: 'settings', description: 'Manage your preferences' },
  { command: 'removeone', description: 'Stop tracking a product' },
  { command: 'ask', description: 'Ask AI about your products' }
]).then(() => {
  console.log('Bot commands menu updated successfully');
}).catch(error => {
  console.error('Failed to set bot commands:', error);
});

// Start Web Dashboard immediately to satisfy Railway health check
startServer(bot);
startKeepAlive();

// Start Worker in the SAME process if simpler hosting is desired (Combined Mode)
// Check env var process_TYPE or NODE_TYPE. Default to combined.
if (!process.env.PROCESS_TYPE || process.env.PROCESS_TYPE === 'combined') {
  logger.info('🔄 Application running in COMBINED mode (Web + Worker)');
  createWorker(bot);
  logger.info('🛠️ Internal Worker started');
} else {
  logger.info(`ℹ️ Application running in ${process.env.PROCESS_TYPE} mode. Worker not started internally.`);
}

// Launch the bot
logger.info('Launching Trackzoon bot...');
botLaunchEnabled = await acquireBotLock();

if (!botLaunchEnabled) {
  logger.warn('Another instance is already polling Telegram. Skipping bot.launch() to avoid conflicts.');
} else {
  bot.launch().then(() => {
    logger.info('Bot successfully launched!');

  }).catch(async error => {
    logger.error('Failed to launch bot:', error);
    captureError(error, { operation: 'bot_launch' });

    // If there's a conflict (409), it means another instance is running
    if (error.response?.error_code === 409) {
      logger.warn('Conflict detected (409). Another instance might be closing. Retrying with jitter...');
      // Random delay between 2000ms and 7000ms to break sync loops
      const jitter = Math.floor(Math.random() * 5000) + 2000;
      await new Promise(resolve => setTimeout(resolve, jitter));
      return bot.launch().then(() => {
        logger.info('Bot successfully launched on retry!');
      }).catch(err => {
        logger.error('Retry failed:', err);
        process.exit(1);
      });
    }

    process.exit(1);
  });
}

// Enable graceful shutdown
const shutdown = (signal) => {
  logger.info(`Received ${signal}. Stopping bot...`);

  // Stop scheduler tasks
  if (stopScheduler) {
    stopScheduler();
  }

  // Close cache connection
  cache.close();

  // Stop bot
  bot.stop(signal);

  // Release bot lock if held
  releaseBotLock().catch(() => {});

  // Clear all states
  stateManager.clearAllStates?.();

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon restarts

// Prevent crash on Puppeteer Protocol Error (TargetCloseError)
process.on('uncaughtException', (error) => {
  if (error.message && error.message.includes('TargetCloseError') && error.message.includes('Protocol error')) {
    logger.error('⚠️ Caught unhandled Puppeteer Protocol Error (preventing crash):', error.message);
    // Do not exit
    return;
  }

  // For other errors, log and exit responsibly
  logger.error('❌ Uncaught Exception:', error);
  captureError(error, { context: 'uncaughtException' });

  // Give it a moment to flush logs then exit
  setTimeout(() => process.exit(1), 1000);
});

process.on('unhandledRejection', (reason, promise) => {
  if (reason && reason.message && reason.message.includes('TargetCloseError')) {
    logger.error('⚠️ Caught unhandled Rejection (Puppeteer Protocol Error):', reason.message);
    return;
  }
  logger.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  captureError(reason, { context: 'unhandledRejection' });
});
