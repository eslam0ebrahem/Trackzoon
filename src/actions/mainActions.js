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
        `💰 Potential Savings: EGP${totalSavings.toFixed(2)}`,
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

      // Build daily report message with smart insights
      const report = {
        totalProducts: products.length,
        priceDrops: [],
        inRange: [],
        belowThreshold: [],
        totalSavings: 0,
        totalDropValue: 0
      };

      products.forEach(product => {
        const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (!tracker) return;

        const priceHistory = product.priceHistory || [];
        const recentPrices = priceHistory.slice(-2);

        // Calculate recent price drops
        if (recentPrices.length >= 2) {
          const priceDrop = recentPrices[0].price - recentPrices[1].price;
          const percentDrop = ((priceDrop / recentPrices[0].price) * 100);
          if (priceDrop > 0) {
            report.priceDrops.push({
              product,
              drop: priceDrop,
              percentDrop: percentDrop,
              oldPrice: recentPrices[0].price,
              newPrice: recentPrices[1].price
            });
            report.totalDropValue += priceDrop;
          }
        }

        // Calculate savings vs threshold
        if (product.currentPrice <= tracker.thresholdPrice) {
          const savings = tracker.thresholdPrice - product.currentPrice;
          report.belowThreshold.push({
            product,
            targetPrice: tracker.thresholdPrice,
            savings: savings
          });
          report.totalSavings += savings;
        } else {
          report.inRange.push(product);
        }
      });

      // Sort price drops by amount (biggest first)
      report.priceDrops.sort((a, b) => b.drop - a.drop);
      // Sort below threshold by savings (biggest savings first)
      report.belowThreshold.sort((a, b) => a.product.currentPrice - b.product.currentPrice); // Sort by current price for "ready to buy"

      // Build message with MessageBuilder if available, or construct manually
      let message = `📊 *Your Daily Snapshot*\n\n`;

      // Summary stats
      message += `📦 *Tracking ${report.totalProducts} Product${report.totalProducts > 1 ? 's' : ''}*\n`;

      const percentBelow = report.totalProducts > 0
        ? ((report.belowThreshold.length / report.totalProducts) * 100).toFixed(0)
        : 0;

      message += `🎯 ${report.belowThreshold.length} at Target (${percentBelow}%)\n`;
      message += `📈 ${report.inRange.length} Above Target\n`;

      if (report.totalSavings > 0) {
        message += `\n💰 *Potential Savings: EGP ${report.totalSavings.toFixed(2)}*\n`;
      }

      // Recent price drops section
      if (report.priceDrops.length > 0) {
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `📉 *${report.priceDrops.length} Price Drop${report.priceDrops.length > 1 ? 's' : ''} Detected*\n\n`;

        report.priceDrops.slice(0, 5).forEach(({ product, drop, percentDrop, oldPrice, newPrice }, index) => {
          // Add urgency badge for big drops
          let badge = '';
          if (percentDrop >= 30) {
            badge = ' 🔥';
          } else if (percentDrop >= 15) {
            badge = ' ⚡';
          }

          const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '•';
          message += `${icon} ${product.name.substring(0, 28)}...${badge}\n`;
          message += `   Was EGP ${oldPrice.toFixed(2)} → *Now EGP ${newPrice.toFixed(2)}*\n`;
          message += `   💸 Save EGP ${drop.toFixed(2)} (${percentDrop.toFixed(1)}% OFF)\n\n`;
        });

        if (report.priceDrops.length > 5) {
          message += `_...and ${report.priceDrops.length - 5} more price drop${report.priceDrops.length - 5 > 1 ? 's' : ''}_\n`;
        }
      }

      // Products at target price
      if (report.belowThreshold.length > 0) {
        message += `\n━━━━━━━━━━━━━━━━━━━━\n`;
        message += `✅ *${report.belowThreshold.length} Product${report.belowThreshold.length > 1 ? 's' : ''} Ready to Buy*\n\n`;

        report.belowThreshold.slice(0, 3).forEach(({ product, targetPrice, savings }) => {
          message += `🛒 ${product.name.substring(0, 28)}...\n`;
          message += `   *EGP ${product.currentPrice.toFixed(2)}* (Target: EGP ${targetPrice.toFixed(2)})\n`;
          if (savings > 0) {
            message += `   💰 EGP ${savings.toFixed(2)} below your target!\n`;
          }
          message += `\n`;
        });

        if (report.belowThreshold.length > 3) {
          message += `_...and ${report.belowThreshold.length - 3} more ready to buy_\n`;
        }
      }

      // Call to action
      if (report.belowThreshold.length > 0 || report.priceDrops.length > 0) {
        message += `\n💡 *Act fast!* Prices change every 30 minutes.\n`;
      } else {
        message += `\n⏳ No deals yet. We're watching for price drops!\n`;
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