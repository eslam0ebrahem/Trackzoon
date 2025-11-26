import { ProductService } from '../services/productService.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('trending', async (ctx) => {
        try {
            const processingMsg = await ctx.reply('🔥 Fetching trending products...');

            // Get top 5 products globally sorted by smartScore
            const { items } = await ProductService.getDealsUnified({
                limit: 5,
                sort: 'smart',
                scope: 'global'
            });

            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

            if (items.length === 0) {
                return await ctx.reply('📉 No trending products found right now.');
            }

            let message = '🚀 *Trending Products (Top 5)*\n\n';

            items.forEach((item, idx) => {
                const p = item.product;
                const score = item.smartScore;
                const emoji = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🔹';

                message += `${emoji} [${p.name.substring(0, 40)}...](${p.url})\n`;
                message += `   💰 *EGP ${p.currentPrice}* | 🔥 Score: ${score}/100\n`;
                if (item.percentChange < 0) {
                    message += `   📉 Drop: ${Math.abs(item.percentChange).toFixed(1)}%\n`;
                }
                message += '\n';
            });

            message += '💡 _Based on AI Smart Score & Price Drops_';

            await ctx.reply(message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true
            });

        } catch (error) {
            handleError(ctx, error);
        }
    });
};
