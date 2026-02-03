import mainActions from './actions/mainActions.js';
import productActions from './actions/productActions.js';
import settingsActions from './actions/settingsActions.js';

// Commands
import startCommand from './commands/startCommand.js';
import helpCommand from './commands/helpCommand.js';
import addCommand from './commands/addCommand.js';
import listCommand from './commands/listCommand.js';
import chartCommand from './commands/chartCommand.js';
import removeoneCommand from './commands/removeoneCommand.js';
import updatepriceCommand from './commands/updatepriceCommand.js';
import reportCommand from './commands/reportCommand.js';
import dealsCommand from './commands/dealsCommand.js';
import settingsCommand from './commands/settingsCommand.js';
import { askCommand } from './commands/askCommand.js';
import addPercentageCommand from './commands/add_percentage.js';

// Text Handler
import textHandler from './handlers/textHandler.js';

const registerHandlers = (bot) => {
  // Register all action handlers
  mainActions(bot);
  productActions(bot);
  settingsActions(bot);

  // Register commands
  startCommand(bot);
  helpCommand(bot);
  addCommand(bot);
  listCommand(bot);
  removeoneCommand(bot);
  updatepriceCommand(bot);
  reportCommand(bot);
  dealsCommand(bot);
  settingsCommand(bot);
  addPercentageCommand(bot);
  bot.command('ask', askCommand);

  chartCommand(bot);

  // Register text handler
  textHandler(bot);
};

export default registerHandlers;
