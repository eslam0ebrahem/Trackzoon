import { initializeConfig } from './config/init.js';
import { initSentry, captureError } from './config/sentry.js';
import cache from './config/cache.js';
import commands from './config/commands.js';
import initializeBot from './core/bot.js';
import registerHandlers from './handlers.js';
import startScheduler from './scheduler/index.js';
import { attachUser, attachState, errorHandler, timeoutHandler } from './middleware/index.js';
import { stateManager } from './utils/stateManager.js';
import { escapeMarkdownV2 } from './utils/messageHelper.js';
import { mainKeyboard } from './utils/keyboards/mainKeyboard.js';

// Initialize Sentry error monitoring first
initSentry();

// Initialize Redis cache (optional)
cache.init();

// Initialize configurations
initializeConfig();

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

// Launch the bot
console.log('Launching Trackzoon bot...');
bot.launch().then(() => {
  console.log('Bot successfully launched!');
}).catch(error => {
  console.error('Failed to launch bot:', error);
  captureError(error, { operation: 'bot_launch' });
  
  // If there's a conflict (409), it means another instance is running
  // Exit without retrying to prevent multiple instances
  if (error.response?.error_code === 409) {
    console.error('Another bot instance is already running. Exiting...');
    process.exit(1);
  }
  
  process.exit(1);
});

// Enable graceful shutdown
const shutdown = (signal) => {
  console.log(`Received ${signal}. Stopping bot...`);
  
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
  
  console.log('Graceful shutdown complete');
  process.exit(0);
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
