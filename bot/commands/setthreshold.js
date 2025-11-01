// bot/commands/setthreshold.js
import axios from 'axios';
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.command('setthreshold', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) {
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
                  { text: i18next.t('setThreshold'), callback_data: `setthreshold_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
      return;
    }
    let [, identifier, newThresholdStr] = parts;

    const newThreshold = parseFloat(newThresholdStr);
    if (isNaN(newThreshold) || newThreshold <= 0) {
      return ctx.reply(i18next.t('invalidThreshold'));
    }

    let product;
    const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });

    // Check if the identifier is a number (from the list)
    const listNumber = parseInt(identifier, 10);
    if (!isNaN(listNumber) && listNumber > 0 && listNumber <= products.length) {
      product = products[listNumber - 1];
    } else {
      // Resolve Amazon short link if needed
      if (identifier.includes('amzn.eu') || identifier.includes('amzn.to')) {
        const res = await axios.get(identifier);
        identifier = res.request.res.responseUrl;
      }

      let asin = identifier;
      const asinMatch = identifier.match(/dp\/([A-Za-z0-9]{10})/);
      if (asinMatch) asin = asinMatch[1];

      product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });
    }

    if (!product) return ctx.reply(i18next.t('productNotFoundOrNotTracked'));

    const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
    if (tracker) {
      tracker.thresholdPrice = newThreshold;
      await product.save();
      ctx.reply(i18next.t('thresholdUpdated', { name: product.name, threshold: newThreshold }));
    } else {
      ctx.reply(i18next.t('productNotFoundOrNotTracked')); // Should not happen if product is found with chatId
    }
  });
};
