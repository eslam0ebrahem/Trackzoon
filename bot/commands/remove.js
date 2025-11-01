// bot/commands/remove.js
import axios from 'axios';
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.command('remove', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
      const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
      if (products.length === 0) return ctx.reply(i18next.t('noTrackedProducts'));

      for (const p of products) {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker) {
          const message = `[${p.name}](${p.url})`;
          await ctx.replyWithMarkdown(message, {
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: i18next.t('removeProduct'), callback_data: `remove_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
      return;
    }
    let identifier = parts[1].replace(/[\[\]\(\)]/g, '');

    let product;
    const products = await Product.find({ trackedBy: ctx.chat.id });

    // Check if the identifier is a number (from the list)
    const listNumber = parseInt(identifier, 10);
    if (!isNaN(listNumber) && listNumber > 0 && listNumber <= products.length) {
      product = products[listNumber - 1];
    } else {
      // Resolve short link if needed
      if (identifier.includes('amzn.eu') || identifier.includes('amzn.to')) {
        const res = await axios.get(identifier);
        identifier = res.request.res.responseUrl;
      }

      let asin = identifier;
      const asinMatch = identifier.match(/dp\/([A-Za-z0-9]{10})/);
      if (asinMatch) asin = asinMatch[1];

      product = await Product.findOne({ asin });
    }

    if (!product) return ctx.reply(i18next.t('productNotFound'));

    if (product.trackedBy.includes(ctx.chat.id)) {
      ctx.reply(
        i18next.t('removeConfirmation', { name: product.name }),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: i18next.t('yesRemove'), callback_data: `remove_${product.asin}` },
                { text: i18next.t('noKeep'), callback_data: 'cancel_remove' },
              ],
            ],
          },
        }
      );
    } else {
      ctx.reply(i18next.t('notTracked'));
    }
  });
};
