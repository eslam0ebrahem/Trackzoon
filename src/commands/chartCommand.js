/**
 * Chart Command Handler
 * Shows price history chart for a product
 */

import Product from '../models/Product.js';
import { generatePriceHistoryChart } from '../utils/chartGenerator.js';
import { sendMessage } from '../utils/messageHelper.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
  bot.command('chart', async (ctx) => {
    try {
      const args = ctx.message.text.split(' ').slice(1);
      const productIdentifier = args[0] || null;
      const chatId = ctx.chat.id;

      // If no product specified, show list to choose from
      if (!productIdentifier) {
        const products = await Product.find({ 'trackedBy.chatId': chatId });

        if (products.length === 0) {
          await sendMessage(bot, chatId,
            '📊 You don\'t have any tracked products yet.\n\nUse /add to start tracking products!'
          );
          return;
        }

        // Show keyboard with products
        const keyboard = products.slice(0, 10).map((product, index) => ([{
          text: `${index + 1}. ${product.name.substring(0, 40)}${product.name.length > 40 ? '...' : ''}`,
          callback_data: `chart_${product.asin}`
        }]));

        await sendMessage(bot, chatId,
          '📊 *Select a product to view price history chart:*',
          {
            reply_markup: { inline_keyboard: keyboard },
            parse_mode: 'Markdown'
          }
        );
        return;
      }

      // Show chart for specific product
      const product = await Product.findOne({
        asin: productIdentifier,
        'trackedBy.chatId': chatId
      });

      if (!product) {
        await sendMessage(bot, chatId, '❌ Product not found or you\'re not tracking it.');
        return;
      }

      if (!product.priceHistory || product.priceHistory.length < 2) {
        await sendMessage(bot, chatId,
          `📊 *${product.name}*\n\n` +
          'Not enough price history data yet. Charts will be available after a few price checks.\n\n' +
          `Current Price: EGP${product.currentPrice.toFixed(2)}`
        );
        return;
      }

      // Generate chart
      await sendMessage(bot, chatId, '⏳ Generating price history chart...');

      const tracker = product.trackedBy.find(t => t.chatId === chatId);
      const chartUrl = await generatePriceHistoryChart(
        product.name,
        product.priceHistory,
        tracker?.thresholdPrice
      );

      if (chartUrl) {
        const prices = product.priceHistory.map(h => h.price);
        const minPrice = Math.min(...prices);
        const maxPrice = Math.max(...prices);
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        const currentPrice = product.currentPrice;

        const priceChange = prices.length > 1 ? currentPrice - prices[0] : 0;
        const priceChangePercent = prices.length > 1 ? ((priceChange / prices[0]) * 100).toFixed(1) : 0;

        const trend = priceChange < 0 ? '📉 Decreasing' : priceChange > 0 ? '📈 Increasing' : '➡️ Stable';
        const trendEmoji = priceChange < 0 ? '💚' : priceChange > 0 ? '📛' : 'ℹ️';

        const message = `
📊 *Price History Chart*

[${product.name}](${product.url})

${trendEmoji} *Current:* EGP${currentPrice.toFixed(2)} (${priceChange >= 0 ? '+' : ''}${priceChangePercent}%)
💰 *Average:* EGP${avgPrice.toFixed(2)}
🔻 *Lowest:* EGP${minPrice.toFixed(2)}
🔺 *Highest:* EGP${maxPrice.toFixed(2)}

📊 *Trend:* ${trend}
📅 *Tracking Since:* ${new Date(product.priceHistory[0].date).toLocaleDateString()}
📈 *Data Points:* ${product.priceHistory.length}

${tracker?.thresholdPrice ? `🎯 *Your Target:* EGP${tracker.thresholdPrice.toFixed(2)}` : ''}
`;

        await bot.telegram.sendPhoto(chatId, chartUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '🛒 View Product', url: product.url },
                { text: '🔄 Refresh', callback_data: `chart_${product.asin}` }
              ],
              [
                { text: '⚙️ Set Target', callback_data: `setthreshold_${product.asin}` },
                { text: '🗑️ Remove', callback_data: `remove_${product.asin}` }
              ]
            ]
          }
        });
      } else {
        await sendMessage(bot, chatId, '❌ Failed to generate chart. Please try again later.');
      }

    } catch (error) {
      handleError(ctx, error);
    }
  });
};

