// bot/actions/list_products.js
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.action('list_products', async (ctx) => {
    const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
    if (products.length === 0) return ctx.reply(i18next.t('noTrackedProducts'));

    const messages = [];
    for (const p of products) {
      if (p.trackedBy && Array.isArray(p.trackedBy)) {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker) {
          const message = `[${p.name}](${p.url}) (Alert at ${tracker.thresholdPrice || p.thresholdPrice} EGP)`;
          messages.push({
            message: message,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: i18next.t('viewProduct'), callback_data: `view_${p.asin}` },
                  { text: i18next.t('removeProduct'), callback_data: `remove_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
    }

    if (messages.length === 0) {
      return ctx.reply(i18next.t('noTrackedProducts'));
    }

    for (const msg of messages) {
      await ctx.replyWithMarkdown(msg.message, {
        disable_web_page_preview: true,
        reply_markup: msg.reply_markup,
      });
    }
  });
};
