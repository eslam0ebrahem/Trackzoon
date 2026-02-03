import crypto from 'crypto';
import User from '../models/User.js';
import { DASHBOARD_USER_ID } from '../config/constants.js';

export class DashboardUserService {
  static async getOrCreateDashboardUser() {
    let user = await User.findOne({ telegramId: DASHBOARD_USER_ID });

    if (!user) {
      user = await User.create({
        telegramId: DASHBOARD_USER_ID,
        firstName: 'Dashboard Admin'
      });
    }

    return user;
  }

  static async getSettings() {
    const user = await this.getOrCreateDashboardUser();
    return {
      webhookUrl: user.webhookUrl,
      apiKey: user.apiKey
    };
  }

  static async updateSettings({ webhookUrl }) {
    const user = await User.findOneAndUpdate(
      { telegramId: DASHBOARD_USER_ID },
      { $set: { webhookUrl } },
      { new: true, upsert: true }
    );

    return { webhookUrl: user.webhookUrl };
  }

  static async generateApiKey() {
    const apiKey = `tk_${crypto.randomBytes(16).toString('hex')}`;

    const user = await User.findOneAndUpdate(
      { telegramId: DASHBOARD_USER_ID },
      { $set: { apiKey } },
      { new: true, upsert: true }
    );

    return { apiKey: user.apiKey };
  }
}
