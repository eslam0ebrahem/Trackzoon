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

// Enable graceful stop
process.once('SIGINT', () => {
  console.log('Received SIGINT. Stopping bot...');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('Received SIGTERM. Stopping bot...');
  bot.stop('SIGTERM');
});
