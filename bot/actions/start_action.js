// bot/commands/start.js

export default (bot, i18next) => {
  bot.start((ctx) => {
    ctx.reply(i18next.t('startMessage'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: i18next.t('addCommand'), callback_data: 'add_product' }],
          [{ text: i18next.t('listCommand'), callback_data: 'list_products' }],
          [{ text: i18next.t('helpCommand'), callback_data: 'show_help' }],
        ],
      },
    });
  });
};
