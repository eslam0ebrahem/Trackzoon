import { ProductService } from '../services/productService.js';
import {
  productActionsKeyboard,
  thresholdKeyboard,
  percentageKeyboard,
  confirmationKeyboard,
  backToMainKeyboard
} from '../utils/keyboards/mainKeyboard.js';
import { formatProductDetails, escapeMarkdownV2, safeEditMessageText, formatProductLine } from '../utils/messageHelper.js';
import { paginateItems, createPaginationKeyboard } from '../utils/pagination.js';
import { MessageBuilder } from '../utils/messageDesign.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { generatePriceHistoryChart } from '../utils/chartGenerator.js';
import { handleError } from '../utils/errorHandler.js';
import { renderDealsList } from '../utils/dealsRenderer.js';
import { buildSmartTargetSuggestions } from '../utils/smartTarget.js';
import { marketIntelligenceService } from '../services/marketIntelligenceService.js';
import Product from '../models/Product.js';

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
      const autoTargetHint = 'Tip: Enable Auto Target in Settings to send URL only.';
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
        escapeMarkdownV2(autoTargetHint),
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

  // Smart target suggestions
  bot.action(/action_smart_target_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const { suggestions, stats30d, dropProbability } = buildSmartTargetSuggestions(product);

      if (!suggestions || suggestions.length === 0) {
        return await ctx.answerCbQuery('Not enough data to suggest a target yet.');
      }

      const name = escapeMarkdownV2(product.name || product.asin || 'Product');
      const current = product.currentPrice ? `EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}` : 'N/A';
      const statsLine = stats30d
        ? `📊 30d Low: EGP${escapeMarkdownV2(stats30d.min.toFixed(2))}  Avg: EGP${escapeMarkdownV2(stats30d.average.toFixed(2))}`
        : '📊 Not enough history yet';
      const probLine = dropProbability !== null ? `🎲 Drop Chance: ${escapeMarkdownV2(String(dropProbability))}%` : '';

      const lines = [
        '🧠 *Smart Target Suggestions*',
        '',
        `📦 ${name}`,
        `💰 Current: ${current}`,
        statsLine,
        probLine,
        '',
        'Choose a target:'
      ].filter(Boolean);

      suggestions.forEach(s => {
        lines.push(`*${escapeMarkdownV2(s.label)}* target: EGP${escapeMarkdownV2(s.targetPrice.toFixed(2))}`);
        lines.push(`_${escapeMarkdownV2(s.reason)}_`);
        lines.push('');
      });

      const keyboard = suggestions.map(s => ([
        {
          text: `${s.label} (EGP${s.targetPrice.toFixed(2)})`,
          callback_data: `action_apply_smart_target_${asin}_${s.targetPrice.toFixed(2)}`
        }
      ]));

      keyboard.push([{ text: '🔙 Back', callback_data: `action_view_${asin}` }]);

      await safeEditMessageText(ctx, lines.join('\n'), {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: keyboard }
      });
    } catch (error) {
      console.error('Error generating smart target:', error);
      await ctx.answerCbQuery('⚠️ Error generating smart target. Please try again.');
    }
  });

  // Apply smart target
  bot.action(/action_apply_smart_target_(\w+)_([\d\.]+)/, async (ctx) => {
    try {
      const [asin, priceStr] = ctx.match.slice(1);
      const price = parseFloat(priceStr);

      if (isNaN(price) || price <= 0) {
        return await ctx.answerCbQuery('Invalid target price.');
      }

      await ProductService.updateThreshold(asin, ctx.chat.id, price);

      const message = escapeMarkdownV2(`✅ Smart target applied: EGP${price.toFixed(2)}`);
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
      await ctx.answerCbQuery('Target updated');
    } catch (error) {
      console.error('Error applying smart target:', error);
      await ctx.answerCbQuery('⚠️ Error applying target. Please try again.');
    }
  });

  // AI buying advice
  bot.action(/action_ai_advice_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      if (!process.env.GROQ_API_KEY) {
        return await ctx.answerCbQuery('AI is not configured yet.');
      }

      const lastUpdated = product.aiBuyingAdvice?.lastUpdated
        ? new Date(product.aiBuyingAdvice.lastUpdated).getTime()
        : 0;
      const ageHours = (Date.now() - lastUpdated) / (1000 * 60 * 60);

      let advice = product.aiBuyingAdvice;
      if (!advice || ageHours > 72) {
        advice = await marketIntelligenceService.analyzeDeal(product.name, product.currentPrice || 0);
        if (advice && advice.advice) {
          await Product.findOneAndUpdate(
            { asin },
            {
              $set: {
                aiBuyingAdvice: {
                  ...advice,
                  lastUpdated: new Date()
                }
              }
            }
          );
        }
      }

      if (!advice || !advice.advice) {
        return await ctx.answerCbQuery('AI advice unavailable right now.');
      }

      const adviceLabel = advice.advice === 'buy_now'
        ? 'Buy Now'
        : advice.advice === 'wait'
          ? 'Wait'
          : 'Neutral';
      const adviceEmoji = advice.advice === 'buy_now'
        ? '🟢'
        : advice.advice === 'wait'
          ? '🟡'
          : '🔵';

      const messageLines = [
        '🤖 *AI Buying Advice*',
        '',
        `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
        `💰 Current: EGP${escapeMarkdownV2((product.currentPrice || 0).toFixed(2))}`,
        '',
        `${adviceEmoji} *Advice:* ${escapeMarkdownV2(adviceLabel)}`,
        advice.reasoning ? `💡 _${escapeMarkdownV2(advice.reasoning)}_` : '',
        advice.newsSummary ? `📰 ${escapeMarkdownV2(advice.newsSummary)}` : '',
        '',
        'Tap back to return to the product'
      ].filter(Boolean);

      await safeEditMessageText(ctx, messageLines.join('\n'), {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh Advice', callback_data: `action_ai_advice_${asin}` }],
            [{ text: '🔙 Back to Product', callback_data: `action_view_${asin}` }]
          ]
        }
      });
    } catch (error) {
      console.error('Error generating AI advice:', error);
      await ctx.answerCbQuery('⚠️ Error generating AI advice. Please try again.');
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

  // Percentage alert flow
  bot.action(/action_percentage_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      const currentPrice = product.currentPrice ||
        (product.priceHistory.length > 0
          ? product.priceHistory[product.priceHistory.length - 1].price
          : null);

      const message = currentPrice
        ? `Current price: EGP${currentPrice.toFixed(2)}\nChoose a percentage drop alert:`
        : 'Choose a percentage drop alert:';

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...percentageKeyboard(asin)
      });
    } catch (error) {
      console.error('Error in percentage alert action:', error);
      await ctx.answerCbQuery('⚠️ Error setting percentage alert. Please try again.');
    }
  });

  // Set percentage from suggestion
  bot.action(/action_set_percentage_(\w+)_([\d\.]+)/, async (ctx) => {
    try {
      const [asin, percentStr] = ctx.match.slice(1);
      const percentage = parseFloat(percentStr);

      const product = await ProductService.updatePercentageThreshold(asin, ctx.chat.id, percentage);
      const baseline = product.currentUserSubscription?.baselinePrice || product.currentPrice || 0;
      const targetPrice = baseline > 0 ? (baseline * (1 - percentage / 100)) : null;

      const message = escapeMarkdownV2(
        `✅ Alert updated to ${percentage}% drop${targetPrice ? ` (EGP${targetPrice.toFixed(2)})` : ''}`
      );
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in set percentage action:', error);
      await ctx.answerCbQuery('⚠️ Error setting percentage alert. Please try again.');
    }
  });

  // Custom percentage input
  bot.action(/action_custom_percentage_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      stateManager.setState(ctx.chat.id, BotStates.SETTING_PERCENTAGE, { asin });

      const message = escapeMarkdownV2('Enter your desired percentage drop (1-99):');
      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in custom percentage action:', error);
      await ctx.answerCbQuery('⚠️ Error setting percentage alert. Please try again.');
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

      const deals = await ProductService.getDeals(ctx.chat.id);

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

      const { message, keyboard } = renderDealsList(deals, 1, 'action_top_deals_page');

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
      const deals = await ProductService.getDeals(ctx.chat.id);

      const { message, keyboard } = renderDealsList(deals, page, 'action_top_deals_page');

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

  // Snooze alert action
  bot.action(/action_snooze_(\w+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      await ProductService.snoozeProduct(asin, ctx.chat.id, 24); // Snooze for 24 hours
      await ctx.answerCbQuery('💤 Alerts snoozed for 24 hours.');
    } catch (error) {
      console.error('Error in snooze action:', error);
      await ctx.answerCbQuery('⚠️ Error snoozing alerts. Please try again.');
    }
  });
};
