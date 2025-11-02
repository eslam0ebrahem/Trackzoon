// bot/actions/view_product_action.js
import Product from '../models/Product.js';
import { Messages } from '../utils/messages.js';

export default (bot) => {
  bot.action(/view_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

    if (!product) return ctx.editMessageText(Messages.productNotFoundOrNotTracked);

    const currentPrice = product.priceHistory.length > 0 ? product.priceHistory.slice(-1)[0].price : Messages.priceNotAvailable;
    const lastUpdated = product.priceHistory.length > 0 ? new Date(product.priceHistory.slice(-1)[0].date).toLocaleString() : Messages.notAvailable;

    let message = `<b>${product.name}</b>\n\n`;
    message += `Current Price: ${currentPrice} EGP\n`;
    message += `Threshold Price: ${product.thresholdPrice} EGP\n`;
    message += `Last Updated: ${lastUpdated}\n`;
    message += `URL: ${product.url}\n`;

    ctx.editMessageText(message, { parse_mode: 'HTML', disable_web_page_preview: true });
  });
};

