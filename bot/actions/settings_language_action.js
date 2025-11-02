// bot/actions/settings_language_action.js
import { i18next } from '../config/init.js';

export default (bot, i18next) => {
  bot.action('settings_language', (ctx) => {
    ctx.editMessageText(ctx.i18n('chooseLanguage'), {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'English', callback_data: 'set_lang_en' }],
          [{ text: 'العربية', callback_data: 'set_lang_ar' }],
        ],
      },
    });
  });
};
