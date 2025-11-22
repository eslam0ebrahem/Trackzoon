import { ProductService } from '../services/productService.js';
import { renderDealsList } from '../utils/dealsRenderer.js';
import { safeEditMessageText } from '../utils/messageHelper.js';

export default (bot) => {
    // Command handler
    bot.command('deals', async (ctx) => {
        try {
            // Check if user wants global deals via command argument (e.g. /deals global)
            const args = ctx.message.text.split(' ');
            const scope = args[1] === 'global' ? 'global' : 'user';

            const deals = await ProductService.getDeals(ctx.chat.id, scope);

            if (deals.length === 0) {
                const msg = scope === 'global'
                    ? 'No hot deals found globally right now.'
                    : 'No deals found in your tracked products.';

                // Offer to switch scope
                const keyboard = scope === 'user' ? {
                    inline_keyboard: [[{ text: '🌍 Check Global Deals', callback_data: 'deals_scope_global' }]]
                } : undefined;

                return ctx.reply(msg, { reply_markup: keyboard });
            }

            const title = scope === 'global' ? '🌍 *Top Global Deals*' : '🔥 *Your Hot Deals*';
            const { message, keyboard } = renderDealsList(deals, 1, `deals_page_${scope}`, title);

            // Add switch button to keyboard
            const switchBtn = scope === 'user'
                ? { text: '🌍 Global Deals', callback_data: 'deals_scope_global' }
                : { text: '👤 My Deals', callback_data: 'deals_scope_user' };

            // Insert at top of keyboard
            if (keyboard.inline_keyboard) {
                keyboard.inline_keyboard.unshift([switchBtn]);
            } else {
                keyboard.inline_keyboard = [[switchBtn]];
            }

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
    bot.action(/deals_page_(user|global)_(\d+)/, async (ctx) => {
        try {
            const scope = ctx.match[1];
            const page = parseInt(ctx.match[2]);
            const deals = await ProductService.getDeals(ctx.chat.id, scope);

            const title = scope === 'global' ? '🌍 *Top Global Deals*' : '🔥 *Your Hot Deals*';
            const { message, keyboard } = renderDealsList(deals, page, `deals_page_${scope}`, title);

            // Add switch button
            const switchBtn = scope === 'user'
                ? { text: '🌍 Global Deals', callback_data: 'deals_scope_global' }
                : { text: '👤 My Deals', callback_data: 'deals_scope_user' };

            keyboard.inline_keyboard.unshift([switchBtn]);

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

    // Scope switch handler
    bot.action(/deals_scope_(user|global)/, async (ctx) => {
        try {
            const scope = ctx.match[1];
            const deals = await ProductService.getDeals(ctx.chat.id, scope);

            if (deals.length === 0) {
                return ctx.answerCbQuery('No deals found in this view.');
            }

            const title = scope === 'global' ? '🌍 *Top Global Deals*' : '🔥 *Your Hot Deals*';
            const { message, keyboard } = renderDealsList(deals, 1, `deals_page_${scope}`, title);

            // Add switch button
            const switchBtn = scope === 'user'
                ? { text: '🌍 Global Deals', callback_data: 'deals_scope_global' }
                : { text: '👤 My Deals', callback_data: 'deals_scope_user' };

            keyboard.inline_keyboard.unshift([switchBtn]);

            await safeEditMessageText(ctx, message, {
                parse_mode: 'Markdown',
                disable_web_page_preview: true,
                reply_markup: keyboard
            });

            await ctx.answerCbQuery();
        } catch (error) {
            console.error('Error switching deals scope:', error);
            await ctx.answerCbQuery('⚠️ Error switching view.');
        }
    });
};
