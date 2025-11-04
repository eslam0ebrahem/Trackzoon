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
        '📚 *Help & Commands*',
        '',
        '*Basic Commands:*',
        '/start \\- Welcome message and main menu',
        '/help \\- Show this help message',
        '/list \\- View all your tracked products',
        '/deals \\- View top 5 price drops',
        '/report \\- Get your daily summary',
        '',
        '*Adding Products:*',
        '/add <URL> <price> \\- Track a product',
        '   Example: `/add https://amzn\\.to/xxx 99\\.99`',
        '/removeone <ASIN> \\- Stop tracking a product',
        '',
        '*Settings:*',
        '/settings \\- Manage preferences',
        '',
        '💡 *Pro Tips:*',
        '• Set realistic price alerts',
        '• Check /deals daily for best savings',
        '• Enable daily reports in /settings',
        '• Products are checked every 30 minutes',
        '• You get instant notifications',
        '',
        '❓ Need more help? Just ask\\!'
      ].join('\n');

      await ctx.reply(helpMessage, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
