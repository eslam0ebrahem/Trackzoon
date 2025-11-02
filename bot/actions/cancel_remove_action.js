// bot/actions/cancel_remove_action.js
export default (bot) => {
  bot.action('cancel_remove', (ctx) => {
    ctx.editMessageText(
      'Operation cancelled. The product will continue to be tracked.',
      { parse_mode: 'MarkdownV2' }
    );
  });
};
