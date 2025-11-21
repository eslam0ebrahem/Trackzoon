import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /help command handler
 * Shows available commands and usage information
 */
export default (bot) => {
  bot.command('help', async (ctx) => {
    try {
      const helpMessage = [
        '📚 *Trackzoon Help Center*',
        '',
        'I can help you track Amazon prices and save money! 💸',
        '',
        '*🚀 Getting Started*',
        '1️⃣ Find a product on Amazon',
        '2️⃣ Share the link with me',
        '3️⃣ Set your target price',
        '',
        '*📋 Commands*',
        '/add <link> - Track a new product',
        '/list - View your tracked items',
        '/deals - See top price drops',
        '/report - Daily price summary',
        '/settings - Configure alerts',
        '',
        '*💡 Tips*',
        '• You can just paste a link to track it!',
        '• Use /chart to see price history',
        '• Enable daily reports in settings'
      ].join('\n');

      await ctx.reply(helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛍️ Track Product', callback_data: 'action_add_product' },
              { text: '📋 My List', callback_data: 'action_list_products' }
            ],
            [
              { text: '⚙️ Settings', callback_data: 'action_settings' },
              { text: '📞 Support', url: 'https://t.me/TrackzoonSupport' }
            ]
          ]
        }
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
