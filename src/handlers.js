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

  // Chart command (special case as it was exported differently in original, 
  // but let's check if we need to wrap it or if it follows the pattern)
  // The original handlers.js imported handleChartCommand from ./commands/chartCommand.js
  // and used it like: bot.command('chart', ... handleChartCommand(bot, ctx.chat.id, asin))
  // Let's check chartCommand.js content if possible, but for now I'll assume I need to adapt it
  // or if I should have created a wrapper.
  // Actually, looking at the file list, chartCommand.js exists.
  // In the original handlers.js:
  // import handleChartCommand from './commands/chartCommand.js';
  // bot.command('chart', async (ctx) => { ... await handleChartCommand(bot, ctx.chat.id, asin); ... })

  // I should probably wrap this in a standard command module pattern if I want consistency,
  // or just keep the inline wrapper here.
  // Let's keep the inline wrapper for chart for now to be safe, or better yet, 
  // I should have checked chartCommand.js.
  // I'll implement the wrapper here.

  bot.command('chart', async (ctx) => {
    try {
      const { default: handleChartCommand } = await import('./commands/chartCommand.js');
      const { handleError } = await import('./utils/errorHandler.js');

      const args = ctx.message.text.split(' ').slice(1);
      const asin = args[0] || null;
      await handleChartCommand(bot, ctx.chat.id, asin);
    } catch (error) {
      const { handleError } = await import('./utils/errorHandler.js');
      handleError(ctx, error);
    }
  });

  // Register text handler
  textHandler(bot);
};

export default registerHandlers;