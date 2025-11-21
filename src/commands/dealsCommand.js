import { ProductService } from '../services/productService.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { paginateItems, createPaginationKeyboard } from '../utils/pagination.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    const renderDealsList = (deals, page) => {
        const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
            paginateItems(deals, page, 5); // 5 deals per page

        const builder = new MessageBuilder();
        builder.setHeader('Top Price Drops (24h)', '🔥');

        if (totalItems === 0) {
            builder.addLine('No price drops found in the last 24 hours.');
            builder.addTip('We check prices every 30 minutes. Stay tuned!');
            return { message: builder.toString(), keyboard: mainKeyboard().reply_markup };
        }

        builder.addLine(`Found ${totalItems} deal${totalItems > 1 ? 's' : ''}!`);
        builder.addDivider();

        items.forEach((deal, index) => {
            const rank = startIndex + index + 1;
            const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔸';

            builder.addLine(`${icon} *${deal.product.name.substring(0, 40)}...*`);
            builder.addLine(`   ~~£${deal.oldPrice.toFixed(2)}~~ → *£${deal.currentPrice.toFixed(2)}*`);
            builder.addLine(`   💰 Save £${deal.priceDiff.toFixed(2)} (${deal.percentChange.toFixed(1)}% off)`);
            builder.addLine(`   [View on Amazon](${deal.product.url})`);
            builder.addSpacer();
        });

        builder.addDivider();
        builder.addLine(`📄 Page ${currentPage} of ${totalPages}`);

        const keyboard = {
            inline_keyboard: [
                ...createPaginationKeyboard(currentPage, totalPages, 'deals_page'),
                [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
            ]
        };

        return { message: builder.toString(), keyboard };
    };

    const getDealsData = async (chatId) => {
        const products = await ProductService.getUserProducts(chatId);
        const dealsData = [];

        // Helper to get old price
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
            return closestEntry || (priceHistory.length > 0 ? priceHistory[0] : null);
        };

        products.forEach(product => {
            if (product.isOutOfStock || !product.currentPrice) return;
            const oldPriceEntry = getPriceFrom24HoursAgo(product.priceHistory);
            if (!oldPriceEntry) return;

            const oldPrice = oldPriceEntry.price;
            const currentPrice = product.currentPrice;
            const priceDiff = oldPrice - currentPrice;

            if (priceDiff > 0) {
                dealsData.push({
                    product,
                    oldPrice,
                    currentPrice,
                    priceDiff,
                    percentChange: ((currentPrice - oldPrice) / oldPrice) * 100 * -1 // Positive percentage
                });
            }
        });

        // Sort by biggest savings
        return dealsData.sort((a, b) => b.priceDiff - a.priceDiff);
    };

    bot.command('deals', async (ctx) => {
        try {
            const deals = await getDealsData(ctx.chat.id);
            const { message, keyboard } = renderDealsList(deals, 1);

            await ctx.reply(message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: keyboard
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });

    // Handle pagination
    bot.action(/^deals_page_(\d+)$/, async (ctx) => {
        try {
            const page = parseInt(ctx.match[1]);
            const deals = await getDealsData(ctx.chat.id);
            const { message, keyboard } = renderDealsList(deals, page);

            await ctx.editMessageText(message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: keyboard
            });
            await ctx.answerCbQuery();
        } catch (error) {
            console.error('Error in deals pagination:', error);
            await ctx.answerCbQuery('⚠️ Error loading page');
        }
    });
};
