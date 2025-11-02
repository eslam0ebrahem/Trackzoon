// bot/actions/cancel_remove_action.js
export default (bot) => {
  bot.action('cancel_remove', (ctx) => {
    ctx.editMessageText(ctx.i18n('removeCancelled'));
  });
};
