/**
 * Command Handlers Index
 * Registers all command handlers with the bot
 */

import startCommand from './startCommand.js';
import helpCommand from './helpCommand.js';
import listCommand from './listCommand.js';
import addCommand from './addCommand.js';
import { askCommand } from './askCommand.js';

export default (bot) => {
  // Register all commands
  startCommand(bot);
  helpCommand(bot);
  listCommand(bot);
  addCommand(bot);
  bot.command('ask', askCommand);
};
