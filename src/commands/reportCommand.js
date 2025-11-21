import { ProductService } from '../services/productService.js';
import { UserService } from '../services/userService.js';
import { buildDailyReportMessage } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('report', async (ctx) => {
        try {
            const user = await UserService.getOrCreateUser(ctx.chat.id, ctx.from?.first_name || ctx.from?.username);
            const products = await ProductService.getUserProducts(ctx.chat.id);

            const reportMessage = buildDailyReportMessage(
                products.map(p => ({
                    ...p.toObject(),
                    trackedBy: p.trackedBy.filter(t => t.chatId === ctx.chat.id)
                })),
                user.firstName || user.username || 'there'
            );

            await ctx.reply(reportMessage, {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
                ...mainKeyboard()
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
