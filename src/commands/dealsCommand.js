import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('deals', async (ctx) => {
        try {
            // Trigger the action handler
            ctx.update.callback_query = {
                data: 'action_top_deals',
                from: ctx.from,
                message: ctx.message
            };

            const products = await ProductService.getUserProducts(ctx.chat.id);

            if (products.length === 0) {
                return await ctx.reply(
                    '📭 *No Products Being Tracked*\n\nYou need to track products first to see deals\\!\nUse /add to start tracking\\.',
                    {
                        parse_mode: 'MarkdownV2',
                        ...mainKeyboard()
                    }
                );
            }

            // Helper function to get price from ~24 hours ago
            const getPriceFrom24HoursAgo = (priceHistory) => {
                if (!priceHistory || priceHistory.length === 0) return null;

                const now = new Date();
                const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                let closestEntry = null;
                let closestDiff = Infinity;

                for (const entry of priceHistory) {
                    const entryDate = new Date(entry.date);
                    const timeDiff = Math.abs(entryDate.getTime() - twentyFourHoursAgo.getTime());

                    if (timeDiff < closestDiff && timeDiff < 28 * 60 * 60 * 1000 && timeDiff > 20 * 60 * 60 * 1000) {
                        closestDiff = timeDiff;
                        closestEntry = entry;
                    }
                }

                if (!closestEntry && priceHistory.length > 0) {
                    closestEntry = priceHistory[0];
                }

                return closestEntry;
            };

            // Calculate price drops for all products
            const dealsData = [];

            products.forEach(product => {
                if (product.isOutOfStock || !product.currentPrice) return;

                const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
                const oldPriceEntry = getPriceFrom24HoursAgo(product.priceHistory);

                if (!oldPriceEntry) return;

                const oldPrice = oldPriceEntry.price;
                const currentPrice = product.currentPrice;
                const priceDiff = oldPrice - currentPrice;
                const percentChange = ((currentPrice - oldPrice) / oldPrice) * 100;

                // Only include if price dropped
                if (priceDiff > 0) {
                    dealsData.push({
                        product,
                        oldPrice,
                        currentPrice,
                        priceDiff,
                        percentChange: Math.abs(percentChange),
                        tracker
                    });
                }
            });

            if (dealsData.length === 0) {
                const message = [
                    '😊 *No Price Drops Today*',
                    '',
                    'None of your tracked products have dropped in price in the last 24 hours\\.',
                    '',
                    '💡 Don\'t worry\\! We\'re monitoring them every 30 minutes\\.',
                    'You\'ll be notified instantly when prices drop\\!',
                    '',
                    '📋 Use /list to see all your tracked products\\.'
                ].join('\n');

                return await ctx.reply(message, {
                    parse_mode: 'MarkdownV2',
                    ...mainKeyboard()
                });
            }

            // Sort by price difference (biggest savings first)
            dealsData.sort((a, b) => b.priceDiff - a.priceDiff);

            // Take top 5
            const topDeals = dealsData.slice(0, 5);

            let message = [
                '🔥 *Top 5 Price Drops \\(24h\\)*',
                '',
                `Found ${dealsData.length} deal${dealsData.length > 1 ? 's' : ''} in the last 24 hours\\!`,
                '',
                '━━━━━━━━━━━━━━━━━━━━',
                ''
            ].join('\n');

            // Add each deal
            topDeals.forEach((deal, index) => {
                const rank = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}\\.`;
                const name = escapeMarkdownV2(deal.product.name.substring(0, 50) + (deal.product.name.length > 50 ? '...' : ''));

                message += `${rank} *${name}*\n`;
                message += `   ~~£${escapeMarkdownV2(deal.oldPrice.toFixed(2))}~~ → *£${escapeMarkdownV2(deal.currentPrice.toFixed(2))}*\n`;
                message += `   💰 Save £${escapeMarkdownV2(deal.priceDiff.toFixed(2))} \\(${escapeMarkdownV2(deal.percentChange.toFixed(1))}% off\\)\n`;

                // Check if at or below target
                if (deal.tracker?.thresholdPrice && deal.currentPrice <= deal.tracker.thresholdPrice) {
                    message += `   ✅ *At your target price\\!*\n`;
                }

                message += `   [View on Amazon](${escapeMarkdownV2(deal.product.url)})\n\n`;
            });

            // Add summary
            const totalSavings = topDeals.reduce((sum, deal) => sum + deal.priceDiff, 0);
            message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
            message += `💸 *Total Potential Savings:* £${escapeMarkdownV2(totalSavings.toFixed(2))}\n`;

            if (dealsData.length > 5) {
                message += `\n_\\+${dealsData.length - 5} more deal${dealsData.length - 5 > 1 ? 's' : ''} available\\!_\n`;
            }

            message += `\n💡 Prices checked every 30 minutes\\.`;

            await ctx.reply(message, {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: true,
                ...mainKeyboard()
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
