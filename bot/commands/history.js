// bot/commands/history.js
import axios from 'axios';
import Product from '../models/Product.js';
import { generatePriceChart } from '../utils/chartGenerator.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.command('history', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
      const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
      if (products.length === 0) {
        return ctx.reply(
          'You are not tracking any products\\. Use /add to start tracking\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      for (const p of products) {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker) {
          const message = `[${escapeMarkdownV2(p.name)}](${p.url})`;
          await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [{ text: 'View Price History', callback_data: `history_${p.asin}` }],
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

    if (!product) {
      return ctx.reply(
        'Product not found or you are not tracking it\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }

    let history = product.priceHistory;
    const now = new Date();
    if (range === '7d') {
      history = history.filter(h => (now - new Date(h.date)) / (1000 * 60 * 60 * 24) <= 7);
    } else if (range === '30d') {
      history = history.filter(h => (now - new Date(h.date)) / (1000 * 60 * 60 * 24) <= 30);
    }

    if (history.length < 2) {
      return ctx.reply(
        'Not enough price history data available yet\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }

    const chartUrl = await generatePriceChart(product.name, history);
    const caption = `📊 Price History for ${escapeMarkdownV2(product.name)}`;

    return ctx.replyWithPhoto(chartUrl, {
      caption,
      parse_mode: 'MarkdownV2'
    });
  });
};
