// bot/actions/history_action.js
import { i18next } from '../config/i18n.js';
import Product from '../models/Product.js';
import { generatePriceChart } from '../utils/chartGenerator.js';

export default (bot, i18next) => {
  bot.action(/history_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

    if (!product) return ctx.editMessageText(i18next.t('productNotFoundOrNotTracked'));

    let history = product.priceHistory;
    const now = new Date();
    // Default to 'all' range for action, or could add range selection later

    if (history.length < 2) return ctx.editMessageText(i18next.t('notEnoughData'));

    const chartUrl = await generatePriceChart(product.name, history, i18next.t);

    await ctx.replyWithPhoto(chartUrl, { caption: i18next.t('historyCaption', { name: product.name }) });
    ctx.editMessageReplyMarkup({}); // Remove inline keyboard after action
  });
};
