// bot/commands/help.js
import { i18next } from '../config/i18n.js';
import commands from './commandList.js';

export default (bot, i18next) => {
  bot.command('help', (ctx) => {
    let msg = i18next.t('help') + '\n';
    commands.forEach(c => {
      msg += `/${c.command} — ${i18next.t(c.descriptionKey)}\n`;
    });
    ctx.reply(msg);
  });
};

