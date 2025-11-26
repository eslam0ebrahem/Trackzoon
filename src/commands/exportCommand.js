import { ProductService } from '../services/productService.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('export', async (ctx) => {
        try {
            const processingMsg = await ctx.reply('⏳ Generating your export file...');

            const products = await ProductService.getUserProducts(ctx.chat.id);

            if (products.length === 0) {
                await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });
                return await ctx.reply('❌ You are not tracking any products to export.');
            }

            // Generate CSV content
            const header = 'Name,URL,Current Price (EGP),Target Price (EGP),Status,Smart Score\n';
            const rows = products.map(p => {
                const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
                const name = `"${p.name.replace(/"/g, '""')}"`; // Escape quotes
                const target = tracker?.thresholdPrice || 0;
                const status = p.isOutOfStock ? 'Out of Stock' : 'Active';

                return `${name},${p.url},${p.currentPrice},${target},${status},${p.smartScore || 0}`;
            }).join('\n');

            const csvContent = header + rows;
            const buffer = Buffer.from(csvContent, 'utf-8');

            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

            await ctx.replyWithDocument({
                source: buffer,
                filename: `trackzoon_export_${new Date().toISOString().split('T')[0]}.csv`
            }, {
                caption: `📊 Here is your export of ${products.length} products.`
            });

        } catch (error) {
            handleError(ctx, error);
        }
    });
};
