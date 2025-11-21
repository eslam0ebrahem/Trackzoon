import { ProductService } from '../services/productService.js';
import {
  productActionsKeyboard,
  thresholdKeyboard,
  confirmationKeyboard,
  backToMainKeyboard
} from '../utils/keyboards/mainKeyboard.js';
import { formatProductDetails, escapeMarkdownV2, safeEditMessageText, formatProductLine } from '../utils/messageHelper.js';
import { paginateItems, createPaginationKeyboard } from '../utils/pagination.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { generatePriceHistoryChart } from '../utils/chartGenerator.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
  // Price history action
  bot.action(/action_history_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      if (!product.priceHistory || product.priceHistory.length === 0) {
        return await ctx.answerCbQuery('No price history available yet.');
      }

      const chartUrl = await generatePriceHistoryChart(product.name, product.priceHistory);

      const message = [
        `📈 *Price History for ${escapeMarkdownV2(product.name)}*`,
        '',
        `[View Chart](${chartUrl})`,
        '',
        escapeMarkdownV2('Click the link above to see the full price history chart.')
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Back to Product', callback_data: `action_view_${asin}` }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in price history action:', error);
      await ctx.answerCbQuery('⚠️ Error fetching price history. Please try again.');
    }
  });

  // List products action
  bot.action('action_list_products', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
        paginateItems(products, 1);

      const builder = new MessageBuilder();
      builder.setHeader('Your Tracked Products', '📋');

      if (totalItems === 0) {
        builder.addLine('You are not tracking any products yet.');
        builder.addTip('Use /add to start tracking!');

        await safeEditMessageText(ctx, builder.toString(), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Track New Product', callback_data: 'action_add_product' }],
              [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
            ]
          }
        });
        return;
      }

      builder.addLine(`_Showing ${startIndex + 1}-${endIndex} of ${totalItems}_`);
      builder.addSpacer();

      const productButtons = items.map(p => [
        {
          text: `${p.name.substring(0, 35)}${p.name.length > 35 ? '...' : ''} - ${p.currentPrice ? `EGP${p.currentPrice.toFixed(2)}` : 'N/A'}`,
          callback_data: `action_view_${p.asin}`
        }
      ]);

      builder.addDivider();
      builder.addLine(`📄 Page ${currentPage} of ${totalPages}`);

      const paginationButtons = createPaginationKeyboard(currentPage, totalPages, 'action_list_page');

      const keyboard = [
        ...productButtons,
        ...paginationButtons,
        [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
      ];

      await safeEditMessageText(ctx, builder.toString(), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: keyboard
        }
      });
    } catch (error) {
      console.error('Error in list products action:', error);
      await ctx.answerCbQuery('⚠️ Error fetching products. Please try again.');
    }
  });

  // Handle pagination for action_list_products
  bot.action(/action_list_page_(\d+)/, async (ctx) => {
    try {
      const page = parseInt(ctx.match[1]);
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
        paginateItems(products, page);

      const builder = new MessageBuilder();
      builder.setHeader('Your Tracked Products', '📋');
      builder.addLine(`_Showing ${startIndex + 1}-${endIndex} of ${totalItems}_`);
      builder.addSpacer();

      const productButtons = items.map(p => [
        {
          text: `${p.name.substring(0, 35)}${p.name.length > 35 ? '...' : ''} - ${p.currentPrice ? `EGP${p.currentPrice.toFixed(2)}` : 'N/A'}`,
          callback_data: `action_view_${p.asin}`
        }
      ]);

      builder.addDivider();
      builder.addLine(`📄 Page ${currentPage} of ${totalPages}`);

      const paginationButtons = createPaginationKeyboard(currentPage, totalPages, 'action_list_page');

      const keyboard = [
        ...productButtons,
        ...paginationButtons,
        [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
      ];

      await safeEditMessageText(ctx, builder.toString(), {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: keyboard
        }
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error in pagination:', error);
      await ctx.answerCbQuery('⚠️ Error loading page. Please try again.');
    }
  });

  // Handle pagination info button (does nothing, just shows current page)
  bot.action('pagination_info', async (ctx) => {
    await ctx.answerCbQuery();
  });

  // Add product action
  bot.action('action_add_product', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL_AND_PRICE);
      const message = [
        '🛍️ *Track a New Product*',
        '',
        '📝 *Send me the Amazon link and your target price in one message:*',
        '',
        '💡 *Format:*',
        '`<Amazon URL> <price>`',
        '',
        '📌 *Examples:*',
        '`https://amzn\\.to/xxx 99\\.99`',
        '`https://www\\.amazon\\.com/dp/B08N5XSG8Z 149`',
        '',
        '⚡ *Quick \\& Easy:* Just paste the link, add a space, then type your target price\\!'
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in add product action:', error);
      await ctx.answerCbQuery('⚠️ Error starting product addition. Please try again.');
    }
  });

  // View individual product
  bot.action(/action_view_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);

      const message = formatProductDetails(product, tracker);

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
        ...productActionsKeyboard(asin, product.url)
      });
    } catch (error) {
      console.error('Error in view product action:', error);
      await ctx.answerCbQuery('⚠️ Error fetching product details. Please try again.');
    }
  });

  // Threshold setting flow
  bot.action(/action_threshold_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      if (!product.currentPrice) {
        stateManager.setState(ctx.chat.id, BotStates.SETTING_THRESHOLD, { asin });
        return await safeEditMessageText(ctx,
          'Enter your desired price alert threshold:',
          {
            parse_mode: 'MarkdownV2',
            ...backToMainKeyboard()
          }
        );
      }

      await safeEditMessageText(ctx,
        `Current price: EGP${product.currentPrice.toFixed(2)}
Choose a threshold or set a custom one:`,
        {
          ...thresholdKeyboard(asin, product.currentPrice)
        }
      );
    } catch (error) {
      console.error('Error in threshold action:', error);
      await ctx.answerCbQuery('⚠️ Error setting threshold. Please try again.');
    }
  });

  // Remove product confirmation
  bot.action(/action_remove_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      const message = [
        '❗️ *Confirm Removal*',
        '',
        'Are you sure you want to stop tracking:',
        `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
        '',
        'You won\'t receive any more price alerts\\.'
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...confirmationKeyboard(asin, 'remove')
      });
    } catch (error) {
      console.error('Error in remove action:', error);
      await ctx.answerCbQuery('⚠️ Error removing product. Please try again.');
    }
  });

  // Confirm remove action
  bot.action(/action_confirm_remove_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.removeProduct(asin, ctx.chat.id);

      const message = [
        '✅ *Product Removed*',
        '',
        'Successfully stopped tracking:',
        `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
        '',
        'You can add it back anytime\\!'
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in confirm remove action:', error);
      await ctx.answerCbQuery('⚠️ Error removing product. Please try again.');
    }
  });

  // Cancel remove action
  bot.action(/action_cancel_remove_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      await ctx.answerCbQuery('❌ Removal cancelled');
      // Return to product view
      ctx.update.callback_query.data = `action_view_${asin}`;
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error in cancel remove action:', error);
      await ctx.answerCbQuery('⚠️ Error cancelling removal. Please try again.');
    }
  });

  // Set threshold from suggestion
  bot.action(/action_set_threshold_(\w+)_([\d\.]+)/, async (ctx) => {
    try {
      const [asin, priceStr] = ctx.match.slice(1);
      const price = parseFloat(priceStr);

      await ProductService.updateThreshold(asin, ctx.chat.id, price);

      const message = escapeMarkdownV2(`✅ Threshold updated to EGP${price.toFixed(2)}`);
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in set threshold action:', error);
      await ctx.answerCbQuery('⚠️ Error setting threshold. Please try again.');
    }
  });

  // Custom threshold input
  bot.action(/action_custom_threshold_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      stateManager.setState(ctx.chat.id, BotStates.SETTING_THRESHOLD, { asin });

      const message = escapeMarkdownV2('Enter your desired price alert threshold:');
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in custom threshold action:', error);
      await ctx.answerCbQuery('⚠️ Error setting threshold. Please try again.');
    }
  });

  // Confirm update price action
  bot.action(/action_confirm_update_price_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const state = stateManager.getState(ctx.chat.id);

      if (!state || !state.data) {
        return await ctx.answerCbQuery('⚠️ Session expired. Please try again.');
      }

      const { newThreshold } = state.data;
      await ProductService.updateThreshold(asin, ctx.chat.id, newThreshold);

      stateManager.clearState(ctx.chat.id);

      const message = escapeMarkdownV2(`✅ Alert price updated successfully to EGP${newThreshold.toFixed(2)}!`);
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
      await ctx.answerCbQuery('✅ Price updated!');
    } catch (error) {
      console.error('Error in confirm update price action:', error);
      await ctx.answerCbQuery('⚠️ Error updating price. Please try again.');
    }
  });

  // Cancel update price action
  bot.action(/action_cancel_update_price_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      stateManager.clearState(ctx.chat.id);

      const message = escapeMarkdownV2('❌ Update cancelled. Your old alert price remains unchanged.');
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
      await ctx.answerCbQuery('❌ Update cancelled');
    } catch (error) {
      console.error('Error in cancel update price action:', error);
      await ctx.answerCbQuery('⚠️ Error cancelling update. Please try again.');
    }
  });

  // Top 5 Deals - Best Price Drops
  // Helper function to calculate deals
  const calculateDeals = (products, chatId) => {
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

    const dealsData = [];

    products.forEach(product => {
      if (product.isOutOfStock || !product.currentPrice) return;

      const tracker = product.trackedBy.find(t => t.chatId === chatId);
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

    // Sort by percentage discount (biggest percentage first)
    dealsData.sort((a, b) => b.percentChange - a.percentChange);

    return dealsData;
  };

  // Render deals list with pagination
  const renderDealsList = (deals, page) => {
    const { items, currentPage, totalPages, totalItems, startIndex, endIndex } =
      paginateItems(deals, page, 5); // 5 deals per page

    const builder = new MessageBuilder();

    // Calculate total potential savings across ALL deals
    const totalSavings = deals.reduce((sum, deal) => sum + deal.priceDiff, 0);
    const avgDiscount = deals.reduce((sum, deal) => sum + deal.percentChange, 0) / deals.length;
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

      builder.addLine(`${icon} *${deal.product.name.substring(0, 38)}...*${urgencyBadge}`);
      builder.addLine(`   ~~EGP ${deal.oldPrice.toFixed(2)}~~ → *EGP ${deal.currentPrice.toFixed(2)}*`);
      builder.addLine(`   💸 *Save EGP ${deal.priceDiff.toFixed(2)}* (${deal.percentChange.toFixed(1)}% OFF)`);

      // Check if at or below target
      if (deal.tracker?.thresholdPrice && deal.currentPrice <= deal.tracker.thresholdPrice) {
        builder.addLine(`   ✅ *Hit your target price!*`);
      }

      builder.addLine(`   [🛒 View Deal](${deal.product.url})`);
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
        ...createPaginationKeyboard(currentPage, totalPages, 'action_top_deals_page'),
        [{ text: '📋 All Products', callback_data: 'action_list_products' }],
        [{ text: '🔙 Main Menu', callback_data: 'action_main_menu' }]
      ]
    };

    return { message: builder.toString(), keyboard };
  };

  // Top deals action - initial load
  bot.action('action_top_deals', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);

      if (products.length === 0) {
        const builder = new MessageBuilder();
        builder.setHeader('No Products', '📭');
        builder.addLine('You need to track products first to see deals!');
        builder.addSpacer();
        builder.addTip('Click below to start tracking');

        return await safeEditMessageText(ctx, builder.toString(), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛍️ Track New Product', callback_data: 'action_add_product' }],
              [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
            ]
          }
        });
      }

      const deals = calculateDeals(products, ctx.chat.id);

      if (deals.length === 0) {
        const builder = new MessageBuilder();
        builder.setHeader('No Price Drops Today', '😊');
        builder.addLine('None of your tracked products have dropped in price in the last 24 hours.');
        builder.addSpacer();
        builder.addLine('💡 Don\'t worry! We\'re monitoring them every 30 minutes.');
        builder.addLine('You\'ll be notified instantly when prices drop!');
        builder.addSpacer();
        builder.addTip('Use /list to see all your tracked products');

        return await safeEditMessageText(ctx, builder.toString(), {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 My Products', callback_data: 'action_list_products' }],
              [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
            ]
          }
        });
      }

      const { message, keyboard } = renderDealsList(deals, 1);

      await safeEditMessageText(ctx, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });

      await ctx.answerCbQuery('🔥 Top deals loaded!');
    } catch (error) {
      console.error('Error in top deals action:', error);
      await ctx.answerCbQuery('⚠️ Error loading deals. Please try again.');
    }
  });

  // Top deals pagination handler
  bot.action(/action_top_deals_page_(\d+)/, async (ctx) => {
    try {
      const page = parseInt(ctx.match[1]);
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const deals = calculateDeals(products, ctx.chat.id);

      const { message, keyboard } = renderDealsList(deals, page);

      await safeEditMessageText(ctx, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: keyboard
      });

      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error in top deals pagination:', error);
      await ctx.answerCbQuery('⚠️ Error loading page. Please try again.');
    }
  });

  // Chart action - view price chart for a specific product
  bot.action(/chart_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      await ctx.answerCbQuery('⏳ Generating chart...');

      // Import and use the chart command handler
      const handleChartCommand = (await import('../commands/chartCommand.js')).default;
      await handleChartCommand(bot, ctx.chat.id, asin);

    } catch (error) {
      console.error('Error in chart action:', error);
      await ctx.answerCbQuery('⚠️ Error generating chart. Please try again.');
    }
  });

  // View history action (legacy support)
  bot.action(/view_history_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      await ctx.answerCbQuery('⏳ Generating chart...');

      const handleChartCommand = (await import('../commands/chartCommand.js')).default;
      await handleChartCommand(bot, ctx.chat.id, asin);

    } catch (error) {
      console.error('Error in view history action:', error);
      await ctx.answerCbQuery('⚠️ Error generating chart. Please try again.');
    }
  });
};
