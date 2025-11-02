// bot/actions/setthreshold_action.js
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next, settingThreshold) => {
  bot.action(/setthreshold_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

    if (!product) {
      return ctx.editMessageText(ctx.i18n('productNotFoundOrNotTracked'));
    }

    const currentPrice = product.priceHistory.length > 0 ? product.priceHistory[product.priceHistory.length - 1].price : null;

    if (!currentPrice) {
      settingThreshold.set(ctx.chat.id, asin);
      return ctx.editMessageText(ctx.i18n('promptNewThresholdNoCurrentPrice'));
    }

    const suggestedThresholds = [0.05, 0.10, 0.20].map(percentage => {
      const threshold = (currentPrice * (1 - percentage)).toFixed(2);
      return {
        text: `${(percentage * 100).toFixed(0)}% (${threshold} EGP)`,
        callback_data: `setthreshold_value_${asin}_${threshold}`
      };
    });

    settingThreshold.set(ctx.chat.id, asin);
    ctx.editMessageText(ctx.i18n('promptNewThresholdWithCurrentPrice', { currentPrice: currentPrice }), {
      reply_markup: {
        inline_keyboard: [
          suggestedThresholds,
          [{ text: ctx.i18n('customThreshold'), callback_data: `setthreshold_custom_${asin}` }]
        ]
      }
    });
  });
};
