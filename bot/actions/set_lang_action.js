// bot/actions/set_lang_action.js
import { i18next } from '../config/i18n.js';
import User from '../models/User.js';

export default (bot, i18next) => {
  bot.action(/set_lang_(en|ar)/, async (ctx) => {
    const lang = ctx.match[1];
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { locale: lang }, { upsert: true });
    i18next.changeLanguage(lang);
    ctx.editMessageText(i18next.t('langSetTo', { lang: lang === 'en' ? 'English' : 'العربية' }));
  });
};
