// bot/commands/start.js

export default (bot) => {
  bot.start((ctx) => {
    ctx.reply(ctx.i18n('startMessage'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.i18n('addCommand'), callback_data: 'add_product' }],
          [{ text: ctx.i18n('listCommand'), callback_data: 'list_products' }],
          [{ text: ctx.i18n('helpCommand'), callback_data: 'show_help' }],
        ],
      },
    });
  });
};
