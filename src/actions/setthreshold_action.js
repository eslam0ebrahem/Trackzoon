// bot/actions/setthreshold_action.js
import Product from '../models/Product.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot, settingThreshold) => {
  bot.action(/setthreshold_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

      if (!product) {
        return ctx.editMessageText(
          'Product not found or not being tracked by you\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      const currentPrice = product.currentPrice || 
        (product.priceHistory.length > 0 
          ? product.priceHistory[product.priceHistory.length - 1].price 
          : null);

      if (!currentPrice) {
        settingThreshold.set(ctx.chat.id, asin);
        return ctx.editMessageText(
          'Enter your desired price alert threshold:',
          { parse_mode: 'MarkdownV2' }
        );
      }

      const suggestedThresholds = [0.05, 0.10, 0.20].map(percentage => {
        const threshold = (currentPrice * (1 - percentage)).toFixed(2);
        return {
          text: `${(percentage * 100).toFixed(0)}% (£${threshold})`,
          callback_data: `setthreshold_value_${asin}_${threshold}`
        };
      });

      settingThreshold.set(ctx.chat.id, asin);
      await ctx.editMessageText(
        `Current price: £${currentPrice.toFixed(2)}\n` +
        'Choose a price threshold or set a custom one:',
        {
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              suggestedThresholds,
              [{ text: 'Set Custom Threshold', callback_data: `setthreshold_custom_${asin}` }]
            ]
          }
        }
      );
    } catch (error) {
      console.error('Error in setthreshold action:', error);
      await ctx.editMessageText(
        'Error updating threshold\\. Please try again\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  });
};
