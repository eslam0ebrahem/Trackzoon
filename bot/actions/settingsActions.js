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
        '',
        '*Price Alert Settings*',
        `🎯 Default Alert: ${user.settings.defaultAlertType === 'percentage' ? 'Percentage Drop' : 'Fixed Price'}`,
        `📉 Min. Drop: ${user.settings.minPriceDrop}%`,
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
      
      const message = [
        '🎯 *Choose Default Alert Type*',
        '',
        `*Current:* ${currentType === 'percentage' ? '📊 Percentage Drop' : '💰 Fixed Price'}`,
        '',
        '📌 *Alert Types Explained:*',
        '',
        '*💰 Fixed Price*',
        '• Set a specific price target \\(e\\.g\\., £50\\)',
        '• Get alerted when price reaches that amount',
        '• Best for: Products with known target prices',
        '• Example: "Alert me when it drops to £99\\.99"',
        '',
        '*📊 Percentage Drop*',
        '• Set a percentage threshold \\(e\\.g\\., 20%\\)',
        '• Get alerted on any price drop \\>\\= that %',
        '• Best for: Watching for deals on new products',
        '• Example: "Alert me on 15% or more drops"',
        '',
        '💡 *Note:* You can always override this per product\\!'
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `${currentType === 'fixed' ? '✅ ' : ''}💰 Fixed Price`,
                callback_data: 'action_set_alert_type_fixed'
              }
            ],
            [
              {
                text: `${currentType === 'percentage' ? '✅ ' : ''}📊 Percentage Drop`,
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
      const oldType = user.settings.defaultAlertType;
      
      if (oldType === newType) {
        await ctx.answerCbQuery('ℹ️ This is already your default alert type');
        return;
      }
      
      user.settings.defaultAlertType = newType;
      await user.save();

      await ctx.answerCbQuery(
        `✅ Default changed to ${newType === 'fixed' ? 'Fixed Price' : 'Percentage Drop'}`
      );

      // Return to settings
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error setting alert type:', error);
      await ctx.answerCbQuery('⚠️ Error updating alert type. Please try again.');
    }
  });

  // Set minimum price drop
  bot.action('action_set_min_drop', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const currentMin = user.settings.minPriceDrop;
      
      const message = [
        '📉 *Set Minimum Price Drop*',
        '',
        `*Current Setting:* ${escapeMarkdownV2(currentMin.toString())}%`,
        '',
        '💡 *What is this?*',
        'This filters out small price changes\\.',
        'Only alerts when price drops \\>\\= this percentage\\.',
        '',
        '🎯 *Choose a threshold:*',
        '',
        '• *0%* \\- Alert on any price drop',
        '• *5%* \\- Small drops \\(recommended\\)',
        '• *10%* \\- Moderate drops only',
        '• *15%* \\- Significant drops only',
        '• *20%* \\- Major drops only',
        '',
        '⚡ *Quick tip:* Lower \\= more alerts'
      ].join('\n');

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: currentMin === 0 ? '✅ 0%' : '0%', callback_data: 'action_set_min_drop_0' },
              { text: currentMin === 5 ? '✅ 5%' : '5%', callback_data: 'action_set_min_drop_5' },
              { text: currentMin === 10 ? '✅ 10%' : '10%', callback_data: 'action_set_min_drop_10' }
            ],
            [
              { text: currentMin === 15 ? '✅ 15%' : '15%', callback_data: 'action_set_min_drop_15' },
              { text: currentMin === 20 ? '✅ 20%' : '20%', callback_data: 'action_set_min_drop_20' },
              { text: currentMin === 25 ? '✅ 25%' : '25%', callback_data: 'action_set_min_drop_25' }
            ],
            [
              { text: '⌨️ Custom Value', callback_data: 'action_set_min_drop_custom' }
            ],
            [{ text: '🔙 Back to Settings', callback_data: 'action_settings' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error in set min drop action:', error);
      await ctx.answerCbQuery('⚠️ Error showing minimum drop options. Please try again.');
    }
  });

  // Handle preset minimum drop values
  bot.action(/action_set_min_drop_(\d+)/, async (ctx) => {
    try {
      const newValue = parseInt(ctx.match[1]);
      const user = await UserService.getUserSettings(ctx.chat.id);
      const oldValue = user.settings.minPriceDrop;
      
      if (oldValue === newValue) {
        await ctx.answerCbQuery(`ℹ️ Already set to ${newValue}%`);
        return;
      }
      
      user.settings.minPriceDrop = newValue;
      await user.save();

      await ctx.answerCbQuery(
        `✅ Minimum price drop set to ${newValue}%`
      );

      // Return to settings
      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error setting minimum drop:', error);
      await ctx.answerCbQuery('⚠️ Error updating setting. Please try again.');
    }
  });

  // Handle custom minimum drop value
  bot.action('action_set_min_drop_custom', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      
      stateManager.setState(ctx.chat.id, 'SETTING_MIN_DROP', {
        returnTo: 'settings'
      });
      
      const message = [
        '⌨️ *Enter Custom Percentage*',
        '',
        `*Current:* ${escapeMarkdownV2(user.settings.minPriceDrop.toString())}%`,
        '',
        '📝 *Enter a number between 0 and 100*',
        '',
        '*Examples:*',
        '• Type `7` for 7% minimum',
        '• Type `12` for 12% minimum',
        '• Type `30` for 30% minimum',
        '',
        '💡 This sets the smallest price drop you care about\\.'
      ].join('\n');

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Cancel', callback_data: 'action_settings' }]
          ]
        }
      });
      
      await ctx.answerCbQuery();
    } catch (error) {
      console.error('Error in custom min drop action:', error);
      await ctx.answerCbQuery('⚠️ Error. Please try again.');
    }
  });
};