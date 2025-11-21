import { UserService } from '../services/userService.js';
import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2, safeEditMessageText } from '../utils/messageHelper.js';

export default (bot) => {
  // Settings menu
  bot.action('action_settings', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      
      const message = escapeMarkdownV2([
        '⚙️ *Settings*',
        '',
        '*Notification Settings*',
        `🔔 Price Alerts: ${user.settings.notifications ? 'Enabled' : 'Disabled'}`,
        `📊 Daily Reports: ${user.settings.dailyReport ? 'Enabled' : 'Disabled'}`,
        '',
        'Click the buttons below to change settings:'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { 
                text: `${user.settings.notifications ? '🔕' : '🔔'} ${user.settings.notifications ? 'Disable' : 'Enable'} Alerts`, 
                callback_data: 'action_toggle_notifications' 
              }
            ],
            [
              { 
                text: `${user.settings.dailyReport ? '📊' : '📈'} ${user.settings.dailyReport ? 'Disable' : 'Enable'} Daily Report`, 
                callback_data: 'action_toggle_daily_report' 
              }
            ],
            [{ text: '🔙 Back to Main Menu', callback_data: 'action_main_menu' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in settings action:', error);
      await ctx.answerCbQuery('⚠️ Error showing settings. Please try again.');
    }
  });

  // Toggle notifications
  bot.action('action_toggle_notifications', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      user.settings.notifications = !user.settings.notifications;
      await user.save();

      await ctx.answerCbQuery(
        `🔔 Notifications ${user.settings.notifications ? 'enabled' : 'disabled'}`
      );

      // Refresh settings menu
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling notifications:', error);
      await ctx.answerCbQuery('⚠️ Error updating settings. Please try again.');
    }
  });

  // Toggle daily report
  bot.action('action_toggle_daily_report', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      user.settings.dailyReport = !user.settings.dailyReport;
      await user.save();

      await ctx.answerCbQuery(
        `📊 Daily report ${user.settings.dailyReport ? 'enabled' : 'disabled'}`
      );

      // Refresh settings menu
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling daily report:', error);
      await ctx.answerCbQuery('⚠️ Error updating settings. Please try again.');
    }
  });
};