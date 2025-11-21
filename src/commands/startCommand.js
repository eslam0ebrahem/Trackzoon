import { UserService } from '../services/userService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /start command handler
 * Entry point for new users
 */
export default (bot) => {
  bot.command('start', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username;
      
      // Register user if new
      await UserService.getOrCreateUser(ctx.chat.id, username);
      
      const welcomeMessage = [
        `👋 *Welcome ${escapeMarkdownV2(username)}\\!*`,
        '',
        `I'm your personal Amazon price tracker\\. I'll help you save money by tracking product prices and notifying you when they drop\\!`,
        '',
        `🌟 *What I can do:*`,
        `• Track Amazon product prices 24/7`,
        `• Send instant alerts when prices drop`,
        `• Show price history and trends`,
        `• Help you find the best time to buy`,
        '',
        `🚀 *Quick Start:*`,
        `Just send me any Amazon product link to start tracking\\!`,
        '',
        `Or use the menu below to explore more options\\.\\.\\.`
      ].join('\n');

      await ctx.reply(welcomeMessage, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
