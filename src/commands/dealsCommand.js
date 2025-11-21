import { ProductService } from '../services/productService.js';
import { renderDealsList } from '../utils/dealsRenderer.js';
import { safeEditMessageText } from '../utils/messageHelper.js';

import { handleError } from '../utils/errorHandler.js';
import { calculatePriceStats } from '../utils/priceUtils.js';

export default (bot) => {
    // Command handler
    bot.command('deals', async (ctx) => {
        try {
            const deals = await ProductService.getDeals(ctx.chat.id);

            if (deals.length === 0) {
                return ctx.reply('No hot deals found right now. Check back later!');
            }

            const { message, keyboard } = renderDealsList(deals, 1, 'deals_page');

            await ctx.reply(message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: keyboard
            });
        } catch (error) {
            console.error('Error in deals command:', error);
            await ctx.reply('⚠️ Error fetching deals. Please try again.');
        }
    });

    // Pagination handler
    bot.action(/deals_page_(\d+)/, async (ctx) => {
        try {
            const page = parseInt(ctx.match[1]);
            const deals = await ProductService.getDeals(ctx.chat.id);

            const { message, keyboard } = renderDealsList(deals, page, 'deals_page');

            await safeEditMessageText(ctx, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: keyboard
            });

            await ctx.answerCbQuery();
        } catch (error) {
            console.error('Error in deals pagination:', error);
            await ctx.answerCbQuery('⚠️ Error loading page. Please try again.');
        }
    });
};
