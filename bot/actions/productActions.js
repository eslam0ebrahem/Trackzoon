import { ProductService } from '../services/productService.js';
import { 
  productActionsKeyboard, 
  thresholdKeyboard, 
  confirmationKeyboard,
  backToMainKeyboard 
} from '../utils/keyboards/mainKeyboard.js';
import { buildProductListMessage, formatProductDetails, escapeMarkdownV2 } from '../utils/messageHelper.js';
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

      await ctx.editMessageText(message, {
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
        return await ctx.editMessageText(
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

      const message = buildProductListMessage(products, ctx.chat.id);
      const keyboard = products.map(p => [
        {
          text: `${p.name} - ${p.currentPrice ? `£${p.currentPrice.toFixed(2)}` : 'N/A'}`,
          callback_data: `action_view_${p.asin}`
        }
      ]);

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: {
          inline_keyboard: [
            ...keyboard,
            [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in list products action:', error);
      await ctx.answerCbQuery('⚠️ Error fetching products. Please try again.');
    }
  });

  // Add product action
  bot.action('action_add_product', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL);
      const message = escapeMarkdownV2([
        '🛍️ *Add Product to Track*',
        '',
        'Please send me the Amazon product URL\.',
        '',
        '💡 *Tips:*',
        '• Copy URL from your browser',
        '• Make sure it\'s a product page',
        '• URL should contain product ID',
        '',
        '📝 *Example:*',
        'https://www\.amazon\.com/dp/B08N5XSG8Z'
      ].join('\n'));

      await ctx.editMessageText(message, {
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
      await ctx.editMessageText(message, {
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
        return await ctx.editMessageText(
          'Enter your desired price alert threshold:',
          {
            parse_mode: 'MarkdownV2',
            ...backToMainKeyboard()
          }
        );
      }

      await ctx.editMessageText(
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
      const name = escapeMarkdownV2(product.name);

      const message = escapeMarkdownV2([
        '❗️ *Confirm Removal*',
        '',
        'Are you sure you want to stop tracking:',
        `📦 [${name}](${product.url})?`,
        '',
        'You won\'t receive any more price alerts\.'
      ].join('\n'));

      await ctx.editMessageText(message, {
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
      const name = escapeMarkdownV2(product.name);

      const message = escapeMarkdownV2([
        '✅ *Product Removed*',
        '',
        'Successfully stopped tracking:',
        `📦 [${name}](${product.url})`,
        '',
        'You can add it back anytime\!'
      ].join('\n'));

      await ctx.editMessageText(message, {
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
      await ctx.editMessageText(message, {
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
      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in custom threshold action:', error);
      await ctx.answerCbQuery('⚠️ Error setting threshold. Please try again.');
    }
  });
};
