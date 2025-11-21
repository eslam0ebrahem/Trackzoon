import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2, safeEditMessageText, buildDailyReportMessage } from '../utils/messageHelper.js';
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
      const user = ctx.from;
      const username = user.first_name || user.username || 'there';

      // Use the unified report builder
      // We need to map products to include the specific tracker for this user
      // similar to how reportCommand.js does it, although buildDailyReportMessage
      // handles the array of trackers, passing the specific user context is safer
      // if we want to reuse the exact same logic.
      // However, buildDailyReportMessage expects the raw product objects and finds the tracker itself
      // assuming the first tracker is the user's (which might be a risky assumption in the helper).
      // Let's look at how reportCommand calls it:
      // products.map(p => ({ ...p.toObject(), trackedBy: p.trackedBy.filter(t => t.chatId === ctx.chat.id) }))
      // This ensures the helper sees only THIS user's tracker as the first one.

      const userProducts = products.map(p => {
        // If it's a mongoose document, convert to object, otherwise use as is
        const productObj = p.toObject ? p.toObject() : p;
        return {
          ...productObj,
          trackedBy: productObj.trackedBy.filter(t => t.chatId === ctx.chat.id)
        };
      });

      const message = buildDailyReportMessage(userProducts, username);

      await safeEditMessageText(ctx, message, {
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