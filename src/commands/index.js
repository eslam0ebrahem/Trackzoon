/**
 * Command Handlers Index
 * Registers all command handlers with the bot
 */

import startCommand from './startCommand.js';
import helpCommand from './helpCommand.js';
import listCommand from './listCommand.js';
import addCommand from './addCommand.js';
import removeoneCommand from './removeoneCommand.js';
import dealsCommand from './dealsCommand.js';
import updatepriceCommand from './updatepriceCommand.js';
import { askCommand } from './askCommand.js';
import settingsCommand from './settingsCommand.js';
import reportCommand from './reportCommand.js';
import chartCommand from './chartCommand.js';
import exportCommand from './exportCommand.js';
import searchCommand from './searchCommand.js';
import trendingCommand from './trendingCommand.js';
import healthCommand from './healthCommand.js';
import insightsCommand from './insightsCommand.js';
import digestCommand from './digestCommand.js';

export default (bot) => {
  // Register all commands
  startCommand(bot);
  helpCommand(bot);
  addCommand(bot);
  listCommand(bot);
  removeoneCommand(bot);
  dealsCommand(bot);
  updatepriceCommand(bot);
  askCommand(bot); // Note: askCommand exports { askCommand } so we call it directly if it's a function, or check export
  settingsCommand(bot);
  reportCommand(bot);
  chartCommand(bot);
  exportCommand(bot);
  searchCommand(bot);
  trendingCommand(bot);
  healthCommand(bot);
  insightsCommand(bot);
  digestCommand(bot);
};
