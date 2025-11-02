// bot/actions/remove_product_action.js
import Product from '../models/Product.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.action(/remove_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin });
    if (product) {
      const name = product.name || asin;
      product.trackedBy = product.trackedBy.filter(tracker => tracker.chatId !== ctx.chat.id);
      await product.save();
      ctx.editMessageText(
        `✅ Removed ${escapeMarkdownV2(name)} from your tracked products\\.`,
        { parse_mode: 'MarkdownV2' }
      );
    } else {
      ctx.editMessageText(
        'Product not found\\. It may have been already removed\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  });
};
