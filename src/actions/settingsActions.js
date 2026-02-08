import { UserService } from '../services/userService.js';
import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2, safeEditMessageText } from '../utils/messageHelper.js';
import { stateManager, BotStates } from '../utils/stateManager.js';

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
        `🧠 Alert Sensitivity: ${user.settings.alertSensitivity || 'balanced'}`,
        '',
        '*Advanced Preferences*',
        `🌙 Quiet Mode: ${user.settings.quietMode?.enabled ? `On (${user.settings.quietMode.startHour}:00 - ${user.settings.quietMode.endHour}:00)` : 'Off'}`,
        `📉 Min Discount: ${user.settings.minDiscount > 0 ? user.settings.minDiscount + '%' : 'Any Drop'}`,
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
            [
              {
                text: `${user.settings.quietMode?.enabled ? '☀️' : '🌙'} ${user.settings.quietMode?.enabled ? 'Disable' : 'Enable'} Quiet Mode`,
                callback_data: 'action_toggle_quiet_mode'
              }
            ],
            [
              {
                text: '🕒 Set Quiet Hours',
                callback_data: 'action_set_quiet_hours'
              }
            ],
            [
              {
                text: '📉 Set Min Discount',
                callback_data: 'action_set_min_discount'
              }
            ],
            [
              {
                text: '🧠 Alert Sensitivity',
                callback_data: 'action_set_alert_sensitivity'
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

  // Toggle quiet mode
  bot.action('action_toggle_quiet_mode', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const current = user.settings.quietMode?.enabled || false;
      user.settings.quietMode.enabled = !current;
      await user.save();

      await ctx.answerCbQuery(
        `🌙 Quiet mode ${user.settings.quietMode.enabled ? 'enabled' : 'disabled'}`
      );

      // Refresh settings menu
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling quiet mode:', error);
      await ctx.answerCbQuery('⚠️ Error updating quiet mode. Please try again.');
    }
  });

  // Set quiet hours
  bot.action('action_set_quiet_hours', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.SETTING_QUIET_HOURS);
      const message = escapeMarkdownV2([
        '🕒 *Set Quiet Hours*',
        '',
        'Send the quiet hours in this format:',
        '`22-8` or `22 8`',
        '',
        'This will mute alerts between those hours.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error setting quiet hours:', error);
      await ctx.answerCbQuery('⚠️ Error setting quiet hours. Please try again.');
    }
  });

  // Set min discount
  bot.action('action_set_min_discount', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.SETTING_MIN_DISCOUNT);
      const message = escapeMarkdownV2([
        '📉 *Set Minimum Discount*',
        '',
        'Send a percentage value (0-99).',
        'Example: `10` for 10% minimum drop.',
        '',
        'Send `0` to allow any drop.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error setting min discount:', error);
      await ctx.answerCbQuery('⚠️ Error setting min discount. Please try again.');
    }
  });

  // Alert sensitivity menu
  bot.action('action_set_alert_sensitivity', async (ctx) => {
    try {
      const message = escapeMarkdownV2([
        '🧠 *Alert Sensitivity*',
        '',
        '*Aggressive* - More alerts, catch small drops',
        '*Balanced* - Recommended',
        '*Strict* - Fewer alerts, only strong deals'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '⚡ Aggressive', callback_data: 'action_set_alert_sensitivity_aggressive' }],
            [{ text: '✅ Balanced', callback_data: 'action_set_alert_sensitivity_balanced' }],
            [{ text: '🛡️ Strict', callback_data: 'action_set_alert_sensitivity_strict' }],
            [{ text: '🔙 Back', callback_data: 'action_settings' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error showing alert sensitivity menu:', error);
      await ctx.answerCbQuery('⚠️ Error updating sensitivity. Please try again.');
    }
  });

  // Set alert sensitivity value
  bot.action(/action_set_alert_sensitivity_(aggressive|balanced|strict)/, async (ctx) => {
    try {
      const level = ctx.match[1];
      const user = await UserService.getUserSettings(ctx.chat.id);
      user.settings.alertSensitivity = level;
      await user.save();

      await ctx.answerCbQuery(`🧠 Alert sensitivity set to ${level}`);

      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error setting alert sensitivity:', error);
      await ctx.answerCbQuery('⚠️ Error updating sensitivity. Please try again.');
    }
  });
};
