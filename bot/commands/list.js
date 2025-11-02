// bot/commands/list.js
import Product from '../models/Product.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.command('list', async (ctx) => {
    const products = await Product.find({ 'trackedBy.chatId': ctx.chat.id });
    if (products.length === 0) {
      return ctx.reply(
        'You are not tracking any products\\. Use /add to start tracking\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }

    const messages = [];
    for (const p of products) {
      if (p.trackedBy && Array.isArray(p.trackedBy)) {
        const tracker = p.trackedBy.find(t => t.chatId === ctx.chat.id);
        if (tracker) {
          const thresholdPrice = tracker.thresholdPrice || p.thresholdPrice;
          const message = escapeMarkdownV2(
            `[${p.name}](${p.url})\n` +
            `💰 Current: €${p.currentPrice ? p.currentPrice.toFixed(2) : 'N/A'}\n` +
            `🎯 Alert at: €${thresholdPrice.toFixed(2)}`
          );
          messages.push({
            message: message,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📊 View Details', callback_data: `view_${p.asin}` },
                  { text: '❌ Remove', callback_data: `remove_${p.asin}` },
                ],
                [
                  { text: '📈 Price History', callback_data: `history_${p.asin}` },
                  { text: '🎯 Set Alert', callback_data: `setthreshold_${p.asin}` },
                ],
              ],
            },
          });
        }
      }
    }

    if (messages.length === 0) {
      return ctx.reply(
        'You are not tracking any products\\. Use /add to start tracking\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }

    // Header message
    await ctx.reply(
      escapeMarkdownV2('📋 *Your Tracked Products*\n\n'),
      { parse_mode: 'MarkdownV2' }
    );

    // Product messages
    for (const msg of messages) {
      await ctx.reply(msg.message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        reply_markup: msg.reply_markup,
      });
    }
  });
};
