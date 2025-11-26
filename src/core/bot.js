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

    // Use centralized middleware for user attachment
    bot.use(async (ctx, next) => {
      if (ctx.chat && ctx.chat.id) {
        try {
          const { UserService } = await import('../services/userService.js');
          const user = await UserService.getOrCreateUser(ctx.chat.id);

          // Update user details if changed
          if (user && (ctx.from?.username !== user.username || ctx.from?.first_name !== user.firstName)) {
            user.username = ctx.from?.username;
            user.firstName = ctx.from?.first_name;
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