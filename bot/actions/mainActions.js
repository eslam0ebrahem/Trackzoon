import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
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
      const message = escapeMarkdownV2([
        '📚 *Help & Features*',
        '',
        '1️⃣ *Track Products*',
        '• Send Amazon product URL',
        '• Set your desired price',
        '• Get instant alerts',
        '',
        '2️⃣ *Manage Tracking*',
        '• View tracked products',
        '• Update price thresholds',
        '• Mute/unmute alerts',
        '',
        '3️⃣ *Price Analytics*',
        '• View price history',
        '• Check statistics',
        '• Get insights',
        '',
        'Need more help? Send us a message at @trackzoon\\_support'
      ].join('\n'));

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      console.error('Error in help action:', error);
      await ctx.answerCbQuery('⚠️ Error showing help. Please try again.');
    }
  });
};