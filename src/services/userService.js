import User from '../models/User.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';

export class UserService {
  static async getOrCreateUser(telegramId) {
    try {
      // Ensure telegramId is a string
      const id = String(telegramId);
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Invalid telegramId');
      }
      let user = await User.findOne({ telegramId: id });

      if (!user) {
        logger.info(`Creating new user with telegramId: "${id}"`);
        user = new User({ telegramId: id });
        await user.save();
        logger.info(`User created successfully: "${id}"`);
      }

      return user;
    } catch (error) {
      logger.error('Error getting/creating user:', error);
      throw new BotError(
        'Failed to process user',
        ErrorCodes.DATABASE_ERROR,
        'Failed to process user information. Please try again later.'
      );
    }
  }

  static async getUserSettings(telegramId) {
    try {
      const user = await User.findOne({ telegramId: String(telegramId) });

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

      logger.error('Error fetching user settings:', error);
      throw new BotError(
        'Failed to fetch settings',
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch your settings. Please try again later.'
      );
    }
  }
}