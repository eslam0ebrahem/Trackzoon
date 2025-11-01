// bot/commands/settings.js
import { i18next } from '../config/i18n.js';

export default (bot, i18next) => {
  bot.command('settings', (ctx) => {
    ctx.reply(i18next.t('settingsMessage'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: i18next.t('languageSetting'), callback_data: 'settings_language' }],
        ],
      },
    });
  });
};
