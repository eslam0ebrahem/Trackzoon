// bot/actions/history_action.js
import Product from '../models/Product.js';
import { generatePriceChart } from '../utils/chartGenerator.js';
import { Messages } from '../utils/messages.js';

export default (bot) => {
  bot.action(/history_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

    if (!product) return ctx.editMessageText(Messages.productNotFoundOrNotTracked);

    let history = product.priceHistory;
    const now = new Date();
    // Default to 'all' range for action, or could add range selection later

    if (history.length < 2) return ctx.editMessageText(Messages.notEnoughData);

    const chartUrl = await generatePriceChart(product.name, history);

    await ctx.replyWithPhoto(chartUrl, { caption: Messages.historyCaption({ name: product.name }) });
    ctx.editMessageReplyMarkup({}); // Remove inline keyboard after action
  });
};
