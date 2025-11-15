import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2, safeEditMessageText } from '../utils/messageHelper.js';
import { ProductService } from '../services/productService.js';

export default (bot) => {
  // Main menu action
  bot.action('action_main_menu', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username;
      const message = escapeMarkdownV2([
        `👋 Welcome ${username} to Amazon Price Tracker!`,
        '',
        '🔍 Track Amazon prices and get instant alerts when they drop.',
        '',
        '✨ Choose an option from the menu below:'
      ].join('\n'));

      await ctx.deleteMessage();
      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      console.error('Error in main menu action:', error);
      await ctx.answerCbQuery('⚠️ Error showing main menu. Please try again.');
    }
  });

  // View Statistics action
  bot.action('action_view_stats', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      
      if (products.length === 0) {
        const message = escapeMarkdownV2([
          '📊 *Your Statistics*',
          '',
          '📭 No products tracked yet\\.',
          '',
          'Start tracking products to see your statistics\\!'
        ].join('\n'));

        await safeEditMessageText(ctx, message, {
          parse_mode: 'MarkdownV2',
          ...backToMainKeyboard()
        });
        return;
      }

      // Calculate statistics
      const totalProducts = products.length;
      const productsWithPriceDrops = products.filter(p => {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        return tracker && p.currentPrice < tracker.thresholdPrice;
      }).length;

      const totalSavings = products.reduce((sum, p) => {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker && p.currentPrice < tracker.thresholdPrice) {
          return sum + (tracker.thresholdPrice - p.currentPrice);
        }
        return sum;
      }, 0);

      const avgPriceHistory = products.reduce((sum, p) => {
        return sum + (p.priceHistory?.length || 0);
      }, 0) / totalProducts;

      const message = escapeMarkdownV2([
        '📊 *Your Statistics*',
        '',
        `📦 Products Tracked: ${totalProducts}`,
        `🎯 Below Threshold: ${productsWithPriceDrops}`,
        `💰 Potential Savings: £${totalSavings.toFixed(2)}`,
        `📈 Avg\\. Price Checks: ${avgPriceHistory.toFixed(0)}`,
        '',
        'Keep tracking to maximize your savings\\!'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in view stats action:', error);
      await ctx.answerCbQuery('⚠️ Error loading statistics. Please try again.');
    }
  });

  // Daily Report action
  bot.action('action_report', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      
      if (products.length === 0) {
        const message = escapeMarkdownV2([
          '📊 *Daily Report*',
          '',
          '📭 No products tracked yet\\.',
          '',
          'Start tracking products to see your daily report\\!'
        ].join('\n'));

        await safeEditMessageText(ctx, message, {
          parse_mode: 'MarkdownV2',
          ...backToMainKeyboard()
        });
        await ctx.answerCbQuery('No products to report');
        return;
      }

      // Build daily report message
      const report = {
        totalProducts: products.length,
        priceDrops: [],
        inRange: [],
        belowThreshold: []
      };

      products.forEach(product => {
        const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (!tracker) return;

        const priceHistory = product.priceHistory || [];
        const recentPrices = priceHistory.slice(-2);
        
        if (recentPrices.length >= 2) {
          const priceDrop = recentPrices[0].price - recentPrices[1].price;
          if (priceDrop > 0) {
            report.priceDrops.push({ product, drop: priceDrop });
          }
        }

        if (product.currentPrice <= tracker.thresholdPrice) {
          report.belowThreshold.push(product);
        } else {
          report.inRange.push(product);
        }
      });

      let message = `📊 *Daily Report*\n\n`;
      message += `📦 Total Products: ${report.totalProducts}\n`;
      message += `🎯 Below Threshold: ${report.belowThreshold.length}\n`;
      message += `📈 In Range: ${report.inRange.length}\n\n`;

      if (report.priceDrops.length > 0) {
        message += `🔥 *Recent Price Drops:*\n`;
        report.priceDrops.slice(0, 5).forEach(({ product, drop }) => {
          message += `• ${product.name.substring(0, 30)}... \\-£${drop.toFixed(2)}\n`;
        });
        message += '\n';
      }

      if (report.belowThreshold.length > 0) {
        message += `✅ *Products at Target Price:*\n`;
        report.belowThreshold.slice(0, 3).forEach(product => {
          message += `• ${product.name.substring(0, 30)}... £${product.currentPrice}\n`;
        });
      }

      await safeEditMessageText(ctx, escapeMarkdownV2(message), {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
      await ctx.answerCbQuery('Report generated');
    } catch (error) {
      console.error('Error in report action:', error);
      await ctx.answerCbQuery('⚠️ Error generating report. Please try again.');
    }
  });

  // Help action
  bot.action('action_help', async (ctx) => {
    try {
      const helpMessage = escapeMarkdownV2([
        '📚 *Available Commands*',
        '',
        '🔰 *Basic Commands:*',
        '/start \\- Start the bot and see welcome message',
        '/help \\- Show this help message',
        '/settings \\- Configure your preferences',
        '',
        '📦 *Product Management:*',
        '/add <URL> <price> \\- Add a new product to track',
        '/list \\- View all tracked products',
        '/removeone <ASIN or name> \\- Remove a tracked product',
        '/updateprice <ASIN or name> <new_price> \\- Update a product\'s alert price',
        '',
        '💡 *Pro Tips:*',
        '• Send an Amazon link directly to add a product',
        '• Use inline buttons for quick actions',
        '• Check /list regularly for price updates'
      ].join('\n'));

      if (ctx.update.callback_query.message.text !== helpMessage) {
        await safeEditMessageText(ctx, helpMessage, {
          parse_mode: 'MarkdownV2',
          ...backToMainKeyboard()
        });
      } else {
        await ctx.answerCbQuery('You are already on the help page.');
      }
    } catch (error) {
      console.error('Error in help action:', error);
      await ctx.answerCbQuery('⚠️ Error showing help. Please try again.');
    }
  });
};