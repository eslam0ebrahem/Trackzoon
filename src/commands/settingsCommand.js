import { UserService } from '../services/userService.js';
import { buildSettingsMessage } from '../utils/messageHelper.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('settings', async (ctx) => {
        try {
            const user = await UserService.getUserSettings(ctx.chat.id);
            const message = buildSettingsMessage(user);

            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '⚙️ Settings', callback_data: 'action_settings' }
                    ]]
                }
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
