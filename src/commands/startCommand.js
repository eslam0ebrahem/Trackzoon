import { UserService } from '../services/userService.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /start command handler
 * Entry point for new users
 */
export default (bot) => {
  bot.command('start', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username || 'there';

      // Register user if new
      await UserService.getOrCreateUser(ctx.chat.id, username);

      const builder = new MessageBuilder();
      builder.setHeader(`Hi ${username}!`, '👋');
      builder.addLine("I'm *Trackzoon*, your personal Amazon price tracker. 🕵️‍♂️");
      builder.addSpacer();
      builder.addLine('I check prices 24/7 and notify you the moment they drop. 📉');
      builder.addSpacer();
      builder.addSection('🚀 Ready to save money?');
      builder.addLine('Click the button below to track your first product, or just paste an Amazon link here!');

      await ctx.reply(builder.toString(), {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🛍️ Track My First Product', callback_data: 'action_add_product' }
            ],
            [
              { text: '📚 How it Works', callback_data: 'action_help' },
              { text: '🏆 See Top Deals', callback_data: 'action_top_deals' }
            ]
          ]
        }
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
