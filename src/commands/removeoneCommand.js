import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('removeone', async (ctx) => {
        try {
            const identifier = ctx.message.text.split(' ').slice(1).join(' ');
            if (!identifier) {
                return await ctx.reply(
                    escapeMarkdownV2('Please provide a product ASIN or name to remove.'),
                    { parse_mode: 'MarkdownV2' }
                );
            }

            const products = await ProductService.getUserProducts(ctx.chat.id);
            const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

            if (!product) {
                return await ctx.reply(
                    escapeMarkdownV2(`Could not find a product matching "${identifier}".`),
                    { parse_mode: 'MarkdownV2' }
                );
            }

            // Show confirmation before removing
            const productName = escapeMarkdownV2(product.name);
            const message = [
                '❗️ *Confirm Removal*',
                '',
                'Are you sure you want to stop tracking:',
                `📦 [${productName}](${escapeMarkdownV2(product.url)})?`,
                '',
                escapeMarkdownV2("You won't receive any more price alerts for this product.")
            ].join('\n');

            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '✅ Yes, Remove', callback_data: `action_confirm_remove_${product.asin}` },
                            { text: '❌ No, Keep', callback_data: `action_cancel_remove_${product.asin}` }
                        ]
                    ]
                },
                disable_web_page_preview: true
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
