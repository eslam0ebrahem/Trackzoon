import { Telegraf } from 'telegraf';
import User from '../models/User.js';

const initializeBot = (commands) => {
  let bot;
  try {
    if (!process.env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN is not defined in environment variables.');
    }
    bot = new Telegraf(process.env.BOT_TOKEN);
    console.log('Telegram bot initialized.');

    // Set bot commands with direct English descriptions
    const botCommands = commands.map(cmd => ({
      command: cmd.command,
      description: cmd.description || cmd.command
    }));
    bot.telegram.setMyCommands(botCommands);

    bot.use(async (ctx, next) => {
      if (ctx.chat && ctx.chat.id) {
        try {
          let user = await User.findOne({ chatId: ctx.chat.id });
          if (!user) {
            user = new User({
              chatId: ctx.chat.id,
              username: ctx.from?.username,
              firstName: ctx.from?.first_name,
              lastName: ctx.from?.last_name
            });
            await user.save();
          }
          ctx.user = user;
        } catch (error) {
          console.error('Error in user middleware:', error);
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