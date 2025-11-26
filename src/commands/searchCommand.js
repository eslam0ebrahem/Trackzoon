import { ProductService } from '../services/productService.js';
import { formatProductLine } from '../utils/messageHelper.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('search', async (ctx) => {
        try {
            const query = ctx.message.text.replace('/search', '').trim();

            if (!query || query.length < 3) {
                return await ctx.reply('🔍 Please provide a search term (at least 3 characters).\nExample: `/search iphone 15`', { parse_mode: 'Markdown' });
            }

            const processingMsg = await ctx.reply('🔍 Searching global database...');

            // Search using the unified getDeals method but with a text search query
            // Note: We need to ensure ProductService supports text search. 
            // If not, we might need to add a specific search method or use regex on the fly (slow but works for small DBs).
            // For now, let's assume we can use a regex find on Product model directly here or add a method to Service.

            // Let's use ProductService.getDealsUnified but we need to add 'search' param support to it.
            // Or simpler: just do a direct find here for now to prove the concept.

            const { default: Product } = await import('../models/Product.js');

            const products = await Product.find({
                name: { $regex: query, $options: 'i' },
                isOutOfStock: false
            }).sort({ smartScore: -1 }).limit(10);

            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

            if (products.length === 0) {
                return await ctx.reply(`❌ No products found matching "${query}".`);
            }

            let message = `🔍 *Search Results for "${query}"*\n\n`;

            products.forEach((p, idx) => {
                const price = p.currentPrice;
                const score = p.smartScore || 0;
                const emoji = score >= 80 ? '🔥' : score >= 60 ? '✨' : '📦';

                message += `${idx + 1}\\. ${emoji} [${p.name.substring(0, 40)}...](${p.url})\n`;
                message += `   💰 *EGP ${price}* | 🧠 Score: ${score}\n\n`;
            });

            message += '💡 _Click link to view on Amazon_';

            await ctx.reply(message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

        } catch (error) {
            handleError(ctx, error);
        }
    });
};
