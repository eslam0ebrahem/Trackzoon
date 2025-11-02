// bot/commands/settings.js
import { i18next } from '../config/i18n.js';

export default (bot, i18next) => {
  bot.command('settings', (ctx) => {
    ctx.reply(ctx.i18n('settingsMessage'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: ctx.i18n('languageSetting'), callback_data: 'settings_language' }],
        ],
      },
    });
  });
};
