// bot/actions/list_products.js
import Product from '../models/Product.js';
import { buildProductListMessage, escapeMarkdownV2 } from '../utils/messageHelper.js';
import { Messages } from '../utils/messages.js';

export default (bot) => {
  bot.action('list_products', async (ctx) => {
    const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
    if (!products || products.length === 0) return ctx.reply(Messages.noTrackedProducts);

    // Build a single nicely formatted MarkdownV2 message with all products
    const listMessage = buildProductListMessage(products, ctx.chat.id);
    if (!listMessage) return ctx.reply(Messages.noTrackedProducts);

    try {
      await ctx.replyWithMarkdownV2(listMessage, { disable_web_page_preview: true });
    } catch (err) {
      // Fallback: send simple text without Markdown formatting
      console.error('Failed sending MarkdownV2 list, falling back to plain text:', err);
      const fallback = products.map((p, i) => `${i + 1}. ${escapeMarkdownV2(p.name || p.asin)}`).join('\n');
      await ctx.reply(fallback);
    }

    // Send inline buttons per product separately so user can act on each one
    for (const p of products) {
      const tracker = Array.isArray(p.trackedBy) ? p.trackedBy.find(t => t.chatId === ctx.chat.id) : null;
      if (!tracker) continue;
      await ctx.reply(Messages.manageProductActions, {
        reply_markup: {
          inline_keyboard: [
            [
              { text: Messages.viewProduct, callback_data: `view_${p.asin}` },
              { text: Messages.removeProduct, callback_data: `remove_${p.asin}` },
            ],
            [
              { text: Messages.setThreshold, callback_data: `setthreshold_custom_${p.asin}` },
            ],
          ],
        },
      });
    }
  });
};
