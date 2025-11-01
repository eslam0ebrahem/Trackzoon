// bot/actions/show_help.js
import commands from '../commands/commandList.js';

export default (bot, i18next) => {
  bot.action('show_help', (ctx) => {
    let msg = i18next.t('help') + '\n';
    commands.forEach(c => {
      msg += `/${c.command} — ${i18next.t(c.descriptionKey)}\n`;
    });
    ctx.reply(msg);
  });
};