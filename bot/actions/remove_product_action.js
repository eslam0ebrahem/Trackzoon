// bot/actions/remove_product_action.js
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.action(/remove_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin });
    if (product) {
      product.trackedBy = product.trackedBy.filter(tracker => tracker.chatId !== ctx.chat.id);
      await product.save();
      ctx.editMessageText(ctx.i18n('removed'));
    } else {
      ctx.editMessageText(ctx.i18n('productNotFound'));
    }
  });
};
