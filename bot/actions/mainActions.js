import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
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

        await ctx.editMessageText(message, {
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

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error in view stats action:', error);
      await ctx.answerCbQuery('⚠️ Error loading statistics. Please try again.');
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
        await ctx.editMessageText(helpMessage, {
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