// bot/actions/add_product.js

export default (bot, i18next) => {
  bot.action('add_product', (ctx) => ctx.reply(i18next.t('addUsage')));
};
