import 'dotenv/config';
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
  { command: 'list', description: 'View your tracked products' },
  { command: 'deals', description: 'See top 5 price drops (24h)' },
  { command: 'report', description: 'Get your daily price report' },
  { command: 'chart', description: 'View price history chart' },
  { command: 'settings', description: 'Manage your preferences' },
  { command: 'removeone', description: 'Stop tracking a product' }
]).then(() => {
  console.log('Bot commands menu updated successfully');
}).catch(error => {
  console.error('Failed to set bot commands:', error);
});

// Start Web Dashboard immediately to satisfy Railway health check
startServer();

// Launch the bot
logger.info('Launching Trackzoon bot...');
bot.launch().then(() => {
  logger.info('Bot successfully launched!');

}).catch(async error => {
  logger.error('Failed to launch bot:', error);
  captureError(error, { operation: 'bot_launch' });

  // If there's a conflict (409), it means another instance is running
  if (error.response?.error_code === 409) {
    logger.warn('Conflict detected (409). Another instance might be closing. Retrying in 3 seconds...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    return bot.launch().then(() => {
      logger.info('Bot successfully launched on retry!');
    }).catch(err => {
      logger.error('Retry failed:', err);
      process.exit(1);
    });
  }

  process.exit(1);
});

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

  // Clear all states
  stateManager.clearAllStates?.();

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
process.once('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon restarts
