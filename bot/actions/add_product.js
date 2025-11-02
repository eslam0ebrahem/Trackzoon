// bot/actions/add_product.js

export default (bot, addingProductState) => {
  bot.action('add_product', (ctx) => {
    addingProductState.set(ctx.chat.id, { step: 'waiting_for_url', data: {} });
    ctx.reply(ctx.i18n('promptForUrl'));
  });
};
