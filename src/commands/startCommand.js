import { UserService } from '../services/userService.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
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
      builder.addLine('Choose an option from the menu below:');

      await ctx.reply(builder.toString(), {
        parse_mode: 'Markdown',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
