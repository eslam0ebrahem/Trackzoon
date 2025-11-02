// bot/commands/start.js

export default (bot) => {
  bot.start((ctx) => {
    const username = ctx.from?.first_name || ctx.from?.username || 'there';
    const message = `👋 Hi ${username}!\n\n` +
      `I'm your Amazon Price Tracker. I'll help you track prices and notify you when they drop.\n\n` +
      `🌟 Features:\n` +
      `• Track multiple products\n` +
      `• Get instant price alerts\n` +
      `• View price history\n` +
      `• Set custom thresholds\n\n` +
      `Get started by adding your first product!`;

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📦 Add Product', callback_data: 'add_product' }],
          [{ text: '📋 View Products', callback_data: 'list_products' }],
          [{ text: '❓ Help', callback_data: 'show_help' }],
        ],
      },
      parse_mode: 'Markdown'
    });
  });
};
