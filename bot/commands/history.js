// bot/commands/history.js
import axios from 'axios';
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';
import { generatePriceChart } from '../utils/chartGenerator.js';

export default (bot, i18next) => {
  bot.command('history', async (ctx) => {
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
                  { text: i18next.t('viewHistory'), callback_data: `history_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
      return;
    }
    let identifier = parts[1].replace(/[\[\]\(\)]/g, '');
    const range = parts[2] || 'all';

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

    let history = product.priceHistory;
    const now = new Date();
    if (range === '7d') {
      history = history.filter(h => (now - new Date(h.date)) / (1000 * 60 * 60 * 24) <= 7);
    } else if (range === '30d') {
      history = history.filter(h => (now - new Date(h.date)) / (1000 * 60 * 60 * 24) <= 30);
    }

    if (history.length < 2) return ctx.reply(i18next.t('notEnoughData'));

    const chartUrl = await generatePriceChart(product.name, history, i18next.t);

    return ctx.replyWithPhoto(chartUrl, { caption: i18next.t('historyCaption', { name: product.name }) });
  });
};
