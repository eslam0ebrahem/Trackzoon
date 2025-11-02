// bot/actions/show_help.js
import commands from '../commands/commandList.js';

export default (bot, i18next) => {
  bot.action('show_help', (ctx) => {
    let msg = ctx.i18n('help') + '\n';
    commands.forEach(c => {
      msg += `/${c.command} — ${ctx.i18n(c.descriptionKey)}\n`;
    });
    ctx.reply(msg);
  });
};