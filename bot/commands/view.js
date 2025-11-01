// bot/commands/view.js
import axios from 'axios';
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';

export default (bot, i18next) => {
  bot.command('view', async (ctx) => {
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
                  { text: i18next.t('viewProduct'), callback_data: `view_${p.asin}` },
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

    const currentPrice = product.priceHistory.length > 0 ? product.priceHistory.slice(-1)[0].price : i18next.t('priceNotAvailable');
    const lastUpdated = product.priceHistory.length > 0 ? new Date(product.priceHistory.slice(-1)[0].date).toLocaleString() : i18next.t('notAvailable');

    let message = `<b>${product.name}</b>\n\n`;
    message += `Current Price: ${currentPrice} EGP\n`;
    message += `Threshold Price: ${product.thresholdPrice} EGP\n`;
    message += `Last Updated: ${lastUpdated}\n`;
    message += `URL: ${product.url}\n`;

    ctx.replyWithHTML(message, { disable_web_page_preview: true });
  });
};
