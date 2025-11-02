import { Telegraf } from 'telegraf';
import User from '../../src/lib/models/User.js';

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
        let user = await User.findOne({ chatId: ctx.chat.id });
        if (!user) {
          user = new User({ chatId: ctx.chat.id });
          await user.save();
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