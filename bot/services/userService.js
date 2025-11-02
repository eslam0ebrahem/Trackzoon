import User from '../models/User.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';

export class UserService {
  static async getOrCreateUser(chatId) {
    try {
      let user = await User.findOne({ chatId });
      
      if (!user) {
        user = new User({ chatId });
        await user.save();
      }
      
      return user;
    } catch (error) {
      console.error('Error getting/creating user:', error);
      throw new BotError(
        'Failed to process user',
        ErrorCodes.DATABASE_ERROR,
        'Failed to process user information. Please try again later.'
      );
    }
  }

  static async getUserSettings(chatId) {
    try {
      const user = await User.findOne({ chatId });
      
      if (!user) {
        throw new BotError(
          'User not found',
          ErrorCodes.DATABASE_ERROR,
          'User not found. Please start the bot first.'
        );
      }
      
      return user;
    } catch (error) {
      if (error instanceof BotError) throw error;
      
      console.error('Error fetching user settings:', error);
      throw new BotError(
        'Failed to fetch settings',
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch your settings. Please try again later.'
      );
    }
  }
}