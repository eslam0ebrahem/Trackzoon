import commands from './commandList.js';

export default (bot) => {
  bot.command('help', (ctx) => {
    let msg = ctx.i18n('help') + '\n';
    commands.forEach(c => {
      msg += `/${c.command} — ${ctx.i_18n(c.descriptionKey)}\n`;
    });
    ctx.reply(msg);
  });
};
