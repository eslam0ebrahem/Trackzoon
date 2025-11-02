import { UserService } from '../services/userService.js';
import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

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
        '*Price Alert Settings*',
        `🎯 Default Alert: ${user.settings.defaultAlertType === 'percentage' ? 'Percentage Drop' : 'Fixed Price'}`,
        `📉 Min. Drop: ${user.settings.minPriceDrop}%`,
        '',
        'Click the buttons below to change settings:'
      ].join('\n'));

      await ctx.editMessageText(message, {
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
            [
              {
                text: '🎯 Change Default Alert Type',
                callback_data: 'action_change_alert_type'
              }
            ],
            [
              {
                text: '📉 Set Minimum Price Drop',
                callback_data: 'action_set_min_drop'
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

  // Change alert type
  bot.action('action_change_alert_type', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const currentType = user.settings.defaultAlertType;
      
      const message = escapeMarkdownV2([
        '🎯 *Choose Default Alert Type*',
        '',
        '*Current Setting:* ' + (currentType === 'percentage' ? 'Percentage Drop' : 'Fixed Price'),
        '',
        '• *Fixed Price:* Alert when price drops below a specific amount',
        '• *Percentage:* Alert when price drops by a certain percentage'
      ].join('\n'));

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '💰 Fixed Price',
                callback_data: 'action_set_alert_type_fixed'
              },
              {
                text: '📊 Percentage',
                callback_data: 'action_set_alert_type_percentage'
              }
            ],
            [{ text: '🔙 Back to Settings', callback_data: 'action_settings' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in change alert type action:', error);
      await ctx.answerCbQuery('⚠️ Error changing alert type. Please try again.');
    }
  });

  // Set alert type handlers
  bot.action(['action_set_alert_type_fixed', 'action_set_alert_type_percentage'], async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const newType = ctx.match[0].includes('fixed') ? 'fixed' : 'percentage';
      user.settings.defaultAlertType = newType;
      await user.save();

      await ctx.answerCbQuery(
        `✅ Default alert type set to ${newType === 'fixed' ? 'Fixed Price' : 'Percentage Drop'}`
      );

      // Return to settings
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error setting alert type:', error);
      await ctx.answerCbQuery('⚠️ Error updating alert type. Please try again.');
    }
  });
};