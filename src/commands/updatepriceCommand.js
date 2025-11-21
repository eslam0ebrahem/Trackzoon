import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('updateprice', async (ctx) => {
        try {
            const parts = ctx.message.text.split(' ');
            if (parts.length < 3) {
                return await ctx.reply(
                    escapeMarkdownV2('❌ Usage: /updateprice <ASIN or name> <new_price>'),
                    { parse_mode: 'MarkdownV2', ...mainKeyboard() }
                );
            }

            const newPrice = parseFloat(parts.pop());
            const identifier = parts.slice(1).join(' ');

            if (isNaN(newPrice) || newPrice <= 0) {
                return await ctx.reply(
                    escapeMarkdownV2('❌ Please provide a valid price.'),
                    { parse_mode: 'MarkdownV2', ...mainKeyboard() }
                );
            }

            const processingMsg = await ctx.reply(
                '🔄 *Updating price alert\\.\\.\\.*',
                { parse_mode: 'MarkdownV2' }
            );

            const products = await ProductService.getUserProducts(ctx.chat.id);
            const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

            if (!product) {
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });
                return await ctx.reply(
                    escapeMarkdownV2(`❌ Could not find a product matching "${identifier}".`),
                    { parse_mode: 'MarkdownV2', ...mainKeyboard() }
                );
            }

            await ProductService.updateThreshold(product.asin, ctx.chat.id, newPrice);

            // Delete processing message
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

            const message = [
                '✅ *Price Alert Updated\\!*',
                '',
                `📦 ${escapeMarkdownV2(product.name)}`,
                `🎯 New Alert Price: £${escapeMarkdownV2(newPrice.toFixed(2))}`,
                '',
                '🔔 You will be notified when the price drops to this level\\!'
            ].join('\n');

            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                ...mainKeyboard()
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
