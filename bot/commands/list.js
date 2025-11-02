// bot/commands/list.js
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.command('list', async (ctx) => {
    const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
    if (products.length === 0) return ctx.reply(ctx.i18n('noTrackedProducts'));

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
                  { text: ctx.i18n('viewProduct'), callback_data: `view_${p.asin}` },
                  { text: ctx.i18n('removeProduct'), callback_data: `remove_${p.asin}` },
                ],
                [
                  { text: ctx.i18n('historyProduct'), callback_data: `history_${p.asin}` },
                  { text: ctx.i18n('setThreshold'), callback_data: `setthreshold_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
    }

    if (messages.length === 0) {
      return ctx.reply(ctx.i18n('noTrackedProducts'));
    }

    for (const msg of messages) {
      await ctx.replyWithMarkdown(msg.message, {
        disable_web_page_preview: true,
        reply_markup: msg.reply_markup,
      });
    }
  });
};
