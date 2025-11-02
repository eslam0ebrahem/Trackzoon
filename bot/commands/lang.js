// bot/commands/lang.js
import { i18next } from '../config/i18n.js';
import User from '../models/User.js';

export default (bot, i18next) => {
  bot.command('lang', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 2 || !['en', 'ar'].includes(parts[1])) {
      return ctx.reply(ctx.i18n('langUsage'));
    }
    const lang = parts[1];
    // Update user model (find by chatId)
    await User.findOneAndUpdate({ chatId: ctx.chat.id }, { locale: lang }, { upsert: true });
    i18next.changeLanguage(lang);
    ctx.reply(ctx.i18n('langSetTo', { lang: lang === 'en' ? 'English' : 'العربية' }));
  });
};
