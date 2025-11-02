// bot/commands/view.js
import axios from 'axios';
import Product from '../models/Product.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.command('view', async (ctx) => {
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
                [{ text: 'View Details', callback_data: `view_${p.asin}` }],
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

    if (!product) {
      return ctx.reply(
        'Product not found or you are not tracking it\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }

    const currentPrice = product.priceHistory.length > 0 
      ? product.priceHistory[product.priceHistory.length - 1].price 
      : 'Not available';

    const lastUpdated = product.priceHistory.length > 0 
      ? new Date(product.priceHistory[product.priceHistory.length - 1].date).toLocaleString() 
      : 'Not available';

    const message = escapeMarkdownV2([
      `*${product.name}*`,
      '',
      `💰 Current Price: €${typeof currentPrice === 'number' ? currentPrice.toFixed(2) : currentPrice}`,
      `🎯 Alert Price: €${product.thresholdPrice.toFixed(2)}`,
      `🕒 Last Updated: ${lastUpdated}`,
      `🔗 [View on Amazon](${product.url})`
    ].join('\n'));

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  });
};
