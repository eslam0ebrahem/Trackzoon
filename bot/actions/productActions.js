import { ProductService } from '../services/productService.js';
import { 
  productActionsKeyboard, 
  thresholdKeyboard, 
  confirmationKeyboard,
  backToMainKeyboard 
} from '../utils/keyboards/mainKeyboard.js';
import { buildProductListMessage, formatProductDetails, escapeMarkdownV2, safeEditMessageText, formatProductLine } from '../utils/messageHelper.js';
import { buildPaginatedProductList, createPaginationKeyboard } from '../utils/pagination.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { generatePriceHistoryChart } from '../utils/chartGenerator.js';

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
      
      if (products.length === 0) {
        return await safeEditMessageText(ctx, 
          escapeMarkdownV2([
            '📭 *No Products Being Tracked*',
            '',
            'You are not tracking any products yet\.',
            'Click the button below to start tracking\!'
          ].join('\n')),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛍️ Track New Product', callback_data: 'action_add_product' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
              ]
            }
          }
        );
      }

      const { message, pagination } = buildPaginatedProductList(
        products,
        ctx.chat.id,
        1,
        formatProductLine,
        escapeMarkdownV2
      );

      // Create inline keyboard with product buttons and pagination
      const productButtons = pagination.items.map(p => [
        {
          text: `${p.name.substring(0, 35)}${p.name.length > 35 ? '...' : ''} - ${p.currentPrice ? `£${p.currentPrice.toFixed(2)}` : 'N/A'}`,
          callback_data: `action_view_${p.asin}`
        }
      ]);

      const paginationButtons = createPaginationKeyboard(
        pagination.currentPage,
        pagination.totalPages,
        'action_list_page'
      );

      const keyboard = [
        ...productButtons,
        ...paginationButtons,
        [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
      ];

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
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

      const { message, pagination } = buildPaginatedProductList(
        products,
        ctx.chat.id,
        page,
        formatProductLine,
        escapeMarkdownV2
      );

      // Create inline keyboard with product buttons and pagination
      const productButtons = pagination.items.map(p => [
        {
          text: `${p.name.substring(0, 35)}${p.name.length > 35 ? '...' : ''} - ${p.currentPrice ? `£${p.currentPrice.toFixed(2)}` : 'N/A'}`,
          callback_data: `action_view_${p.asin}`
        }
      ]);

      const paginationButtons = createPaginationKeyboard(
        pagination.currentPage,
        pagination.totalPages,
        'action_list_page'
      );

      const keyboard = [
        ...productButtons,
        ...paginationButtons,
        [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
      ];

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
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
        ...productActionsKeyboard(asin)
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
        `Current price: £${product.currentPrice.toFixed(2)}
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

      const message = escapeMarkdownV2(`✅ Threshold updated to £${price.toFixed(2)}`);
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

      const message = escapeMarkdownV2(`✅ Alert price updated successfully to £${newThreshold.toFixed(2)}!`);
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
  bot.action('action_top_deals', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      
      if (products.length === 0) {
        return await safeEditMessageText(ctx, 
          escapeMarkdownV2([
            '📭 *No Products Being Tracked*',
            '',
            'You need to track products first to see deals!',
            'Click the button below to start tracking.'
          ].join('\n')),
          {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛍️ Track New Product', callback_data: 'action_add_product' }],
                [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
              ]
            }
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

        return await safeEditMessageText(ctx, message, {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📋 My Products', callback_data: 'action_list_products' }],
              [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
            ]
          }
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
        
        message += `${rank} [${name}](${escapeMarkdownV2(deal.product.url)})\n`;
        message += `   ~~£${escapeMarkdownV2(deal.oldPrice.toFixed(2))}~~ → *£${escapeMarkdownV2(deal.currentPrice.toFixed(2))}*\n`;
        message += `   💰 Save £${escapeMarkdownV2(deal.priceDiff.toFixed(2))} \\(${escapeMarkdownV2(deal.percentChange.toFixed(1))}% off\\)\n`;
        
        // Check if at or below target
        if (deal.tracker?.thresholdPrice && deal.currentPrice <= deal.tracker.thresholdPrice) {
          message += `   ✅ *At your target price\\!*\n`;
        }
        
        message += `\n`;
      });

      // Add summary
      const totalSavings = topDeals.reduce((sum, deal) => sum + deal.priceDiff, 0);
      message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
      message += `💸 *Total Potential Savings:* £${escapeMarkdownV2(totalSavings.toFixed(2))}\n`;
      
      if (dealsData.length > 5) {
        message += `\n_\\+${dealsData.length - 5} more deal${dealsData.length - 5 > 1 ? 's' : ''} available\\!_\n`;
      }
      
      message += `\n💡 Prices checked every 30 minutes\\.`;

      // Create buttons for each deal
      const dealButtons = topDeals.map(deal => [{
        text: `View ${deal.product.name.substring(0, 30)}${deal.product.name.length > 30 ? '...' : ''}`,
        callback_data: `action_view_${deal.product.asin}`
      }]);

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            ...dealButtons,
            [{ text: '📋 All Products', callback_data: 'action_list_products' }],
            [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
          ]
        }
      });

      await ctx.answerCbQuery('🔥 Top deals loaded!');
    } catch (error) {
      console.error('Error in top deals action:', error);
      await ctx.answerCbQuery('⚠️ Error loading deals. Please try again.');
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

