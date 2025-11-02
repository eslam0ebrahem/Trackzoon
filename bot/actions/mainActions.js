import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  // Main menu action
  bot.action('action_main_menu', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username;
      const message = escapeMarkdownV2([
        `👋 Welcome ${username} to Amazon Price Tracker!`,
        '',
        '🔍 Track Amazon prices and get instant alerts when they drop.',
        '',
        '✨ Choose an option from the menu below:'
      ].join('\n'));

      await ctx.deleteMessage();
      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      console.error('Error in main menu action:', error);
      await ctx.answerCbQuery('⚠️ Error showing main menu. Please try again.');
    }
  });

  // Help action
  bot.action('action_help', async (ctx) => {
    try {
      const helpMessage = escapeMarkdownV2([
        '📚 *Available Commands*',
        '',
        '🔰 *Basic Commands:*',
        '/start \\- Start the bot and see welcome message',
        '/help \\- Show this help message',
        '/settings \\- Configure your preferences',
        '',
        '📦 *Product Management:*',
        '/add <URL> <price> \\- Add a new product to track',
        '/list \\- View all tracked products',
        '/removeone <ASIN or name> \\- Remove a tracked product',
        '/updateprice <ASIN or name> <new_price> \\- Update a product\'s alert price',
        '',
        '💡 *Pro Tips:*',
        '• Send an Amazon link directly to add a product',
        '• Use inline buttons for quick actions',
        '• Check /list regularly for price updates'
      ].join('\n'));

      if (ctx.update.callback_query.message.text !== helpMessage) {
        await ctx.editMessageText(helpMessage, {
          parse_mode: 'MarkdownV2',
          ...backToMainKeyboard()
        });
      } else {
        await ctx.answerCbQuery('You are already on the help page.');
      }
    } catch (error) {
      console.error('Error in help action:', error);
      await ctx.answerCbQuery('⚠️ Error showing help. Please try again.');
    }
  });
};