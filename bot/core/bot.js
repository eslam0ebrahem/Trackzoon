import { Telegraf } from 'telegraf';
import User from '../../src/lib/models/User.js';
import { i18next } from '../config/i18n.js';

const initializeBot = (commands) => {
  let bot;
  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN is not defined in environment variables.');
    }
    bot = new Telegraf(process.env.BOT_TOKEN);
    console.log('Telegram bot initialized.');

    const translatedCommands = commands.map(cmd => ({
      command: cmd.command,
      description: i18next.t(cmd.descriptionKey)
    }));
    bot.telegram.setMyCommands(translatedCommands);

    bot.use(async (ctx, next) => {
      if (ctx.chat && ctx.chat.id) {
        let user = await User.findOne({ chatId: ctx.chat.id });
        if (!user) {
          user = new User({ chatId: ctx.chat.id, locale: 'en' });
          await user.save();
        }
        if (user.locale) {
          ctx.i18n = i18next.getFixedT(user.locale);
        } else {
          ctx.i18n = i18next.getFixedT('en'); // Default to English if no locale is set
        }
      }
      return next();
    });

  } catch (error) {
    console.error('Error initializing Telegram bot:', error);
    process.exit(1);
  }
  return bot;
};

export default initializeBot;