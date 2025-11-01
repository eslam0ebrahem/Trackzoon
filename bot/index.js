// src/index.js
import { initializeConfig } from './config/init.js';
initializeConfig();

import commands from './commands/commandList.js';

import initializeBot from './core/bot.js';
const bot = initializeBot(commands);

import registerHandlers from './handlers.js';
registerHandlers(bot);

import startScheduler from './scheduler/index.js';
startScheduler(bot);

// Launch the bot
console.log('Attempting to launch bot...');
bot.launch();

// Optionally handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Disconnecting from MongoDB and stopping bot...');
  bot.stop();
  console.log('Bot stopped and MongoDB disconnected.');
  process.exit(0);
});
