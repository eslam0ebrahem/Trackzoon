// bot/commands/remove.js
import axios from 'axios';
import Product from '../models/Product.js';
import { Messages } from '../utils/messages.js';

export default (bot) => {
  bot.command('remove', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2) {
      const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
      if (products.length === 0) return ctx.reply(Messages.noTrackedProducts);

      for (const p of products) {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker) {
          const message = `[${p.name}](${p.url})`;
          await ctx.replyWithMarkdown(message, {
            disable_web_page_preview: true,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: Messages.removeProduct, callback_data: `remove_${p.asin}` },
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

    if (!product) return ctx.reply(Messages.productNotFound);

    if (product.trackedBy.includes(ctx.chat.id)) {
      ctx.reply(
        Messages.removeConfirmation(product.name),
        {
          reply_markup: {
            inline_keyboard: [
              [
                { text: Messages.yesRemove, callback_data: `remove_${product.asin}` },
                { text: Messages.noKeep, callback_data: 'cancel_remove' },
              ],
            ],
          },
        }
      );
    } else {
      ctx.reply(Messages.notTracked);
    }
  });
};
