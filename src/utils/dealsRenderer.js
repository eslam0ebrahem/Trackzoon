import { MessageBuilder } from './messageDesign.js';
import { createPaginationKeyboard, paginateItems } from './pagination.js';

export const renderDealsList = (deals, page, callbackPrefix) => {
    const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
        paginateItems(deals, page, 5); // 5 deals per page

    const builder = new MessageBuilder();

    // Calculate total potential savings across ALL deals
    const totalSavings = deals.reduce((sum, deal) => sum + deal.priceDiff, 0);
    const biggestDeal = deals[0]; // Already sorted by percentage

    builder.setHeader('🔥 Hot Deals Alert', '💰');

    if (totalItems === 0) {
        builder.addLine('No price drops found in the last 24 hours.');
        builder.addSpacer();
        builder.addTip('We check prices every 30 minutes. New deals coming soon!');
        return {
            message: builder.toString(),
            keyboard: {
                inline_keyboard: [
                    [{ text: '📋 My Products', callback_data: 'action_list_products' }],
                    [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
                ]
            }
        };
    }

    // Smart summary
    builder.addLine(`💎 *${totalItems} Active Deal${totalItems > 1 ? 's' : ''}* • Save up to *${biggestDeal.percentChange.toFixed(0)}%*`);
    builder.addLine(`💰 Total Savings: *EGP ${totalSavings.toFixed(2)}*`);
    builder.addDivider();



    items.forEach((deal, index) => {
        const rank = startIndex + index + 1;
        const icon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🔸';

        // Determine urgency badge
        let urgencyBadge = '';
        if (deal.percentChange >= 40) {
            urgencyBadge = ' 🔥 *MEGA DEAL*';
        } else if (deal.percentChange >= 25) {
            urgencyBadge = ' ⚡ *HOT*';
        }

        // Make product name clickable
        const productName = deal.product.name.substring(0, 45);
        builder.addLine(`${icon} [${productName}...](${deal.product.url})${urgencyBadge}`);
        builder.addLine(`   Was EGP ${deal.oldPrice.toFixed(2)} → *Now EGP ${deal.currentPrice.toFixed(2)}*`);
        builder.addLine(`   💸 *Save EGP ${deal.priceDiff.toFixed(2)}* (${deal.percentChange.toFixed(1)}% OFF)`);

        if (deal.statsAll && deal.stats30d) {
            builder.addLine(`   📉 Low: ${deal.statsAll.min.toFixed(0)} • High: ${deal.statsAll.max.toFixed(0)} • 30d Low: ${deal.stats30d.min.toFixed(0)}`);
        }

        // Check if at or below target
        if (deal.tracker?.thresholdPrice && deal.currentPrice <= deal.tracker.thresholdPrice) {
            builder.addLine(`   ✅ *Hit your target price!*`);
        }

        builder.addSpacer();
    });

    builder.addDivider();

    // Calculate total savings for current page
    const pageSavings = items.reduce((sum, deal) => sum + deal.priceDiff, 0);
    builder.addLine(`💰 *This Page:* EGP ${pageSavings.toFixed(2)} saved`);

    if (totalPages > 1) {
        builder.addLine(`📄 Page ${currentPage} of ${totalPages} • ${totalItems} total deals`);
    }

    builder.addSpacer();
    builder.addTip('⏰ Prices update every 30 min • Grab deals before they expire!');

    const keyboard = {
        inline_keyboard: [
            ...createPaginationKeyboard(currentPage, totalPages, callbackPrefix),
            [{ text: '📋 All Products', callback_data: 'action_list_products' }],
            [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
        ]
    };

    return { message: builder.toString(), keyboard };
};
