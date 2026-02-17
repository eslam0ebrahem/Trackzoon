import { UserService } from '../services/userService.js';
import { mainKeyboard, backToMainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { escapeMarkdownV2, safeEditMessageText } from '../utils/messageHelper.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { resolveAdviceThresholds, resolveConfidenceThresholds } from '../utils/adviceUtils.js';

export default (bot) => {
  // Settings menu
  bot.action('action_settings', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const adviceThresholds = resolveAdviceThresholds(user.settings || {});
      const confidenceThresholds = resolveConfidenceThresholds(user.settings || {});
      
      const message = escapeMarkdownV2([
        '⚙️ *Settings*',
        '',
        '*Notification Settings*',
        `🔔 Price Alerts: ${user.settings.notifications ? 'Enabled' : 'Disabled'}`,
        `📊 Daily Reports: ${user.settings.dailyReport ? 'Enabled' : 'Disabled'}`,
        `🧠 Alert Sensitivity: ${user.settings.alertSensitivity || 'balanced'}`,
        `🎯 Auto Target: ${user.settings.autoTarget?.enabled ? 'Enabled' : 'Disabled'}`,
        `🔁 Watch Again: ${user.settings.watchAgain?.enabled ? 'Enabled' : 'Disabled'}`,
        `🎲 Drop Probability Alerts: ${user.settings.dropProbabilityAlerts?.enabled ? `On (${user.settings.dropProbabilityAlerts.threshold || 65}%)` : 'Off'}`,
        `🤖 AI Score Thresholds: Buy ≥ ${adviceThresholds.buyNow} | Wait ≤ ${adviceThresholds.wait}`,
        `🧪 AI Confidence Guard: Buy ≥ ${confidenceThresholds.buyNow}% | Wait ≥ ${confidenceThresholds.wait}%`,
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
            [
              {
                text: '🧪 AI Confidence Guard',
                callback_data: 'action_ai_confidence_menu'
              }
            ],
            [
              {
                text: `${user.settings.autoTarget?.enabled ? '✅' : '➕'} Auto Target`,
                callback_data: 'action_toggle_auto_target'
              }
            ],
            [
              {
                text: `${user.settings.watchAgain?.enabled ? '✅' : '➕'} Watch Again`,
                callback_data: 'action_toggle_watch_again'
              }
            ],
            [
              {
                text: `${user.settings.dropProbabilityAlerts?.enabled ? '✅' : '➕'} Drop Probability Alerts`,
                callback_data: 'action_toggle_drop_probability'
              }
            ],
            [
              {
                text: '🎲 Set Drop Probability',
                callback_data: 'action_set_drop_probability_threshold'
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

  // Toggle auto target
  bot.action('action_toggle_auto_target', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const current = user.settings.autoTarget?.enabled || false;
      user.settings.autoTarget = user.settings.autoTarget || {};
      user.settings.autoTarget.enabled = !current;
      await user.save();

      await ctx.answerCbQuery(
        `🎯 Auto target ${user.settings.autoTarget.enabled ? 'enabled' : 'disabled'}`
      );

      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling auto target:', error);
      await ctx.answerCbQuery('⚠️ Error updating auto target. Please try again.');
    }
  });

  // Toggle watch again
  bot.action('action_toggle_watch_again', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const current = user.settings.watchAgain?.enabled || false;
      user.settings.watchAgain = user.settings.watchAgain || {};
      user.settings.watchAgain.enabled = !current;
      await user.save();

      await ctx.answerCbQuery(
        `🔁 Watch again ${user.settings.watchAgain.enabled ? 'enabled' : 'disabled'}`
      );

      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling watch again:', error);
      await ctx.answerCbQuery('⚠️ Error updating watch again. Please try again.');
    }
  });

  // Toggle drop probability alerts
  bot.action('action_toggle_drop_probability', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const current = user.settings.dropProbabilityAlerts?.enabled || false;
      user.settings.dropProbabilityAlerts = user.settings.dropProbabilityAlerts || {};
      user.settings.dropProbabilityAlerts.enabled = !current;
      await user.save();

      await ctx.answerCbQuery(
        `🎲 Drop probability alerts ${user.settings.dropProbabilityAlerts.enabled ? 'enabled' : 'disabled'}`
      );

      ctx.update.callback_query.data = 'action_settings';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error toggling drop probability alerts:', error);
      await ctx.answerCbQuery('⚠️ Error updating drop alerts. Please try again.');
    }
  });

  // Set drop probability threshold
  bot.action('action_set_drop_probability_threshold', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.SETTING_DROP_PROBABILITY_THRESHOLD);
      const message = escapeMarkdownV2([
        '🎲 *Set Drop Probability Threshold*',
        '',
        'Send a number between 10 and 95.',
        'Example: `70` will alert when drop chance is 70%+.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error setting drop probability threshold:', error);
      await ctx.answerCbQuery('⚠️ Error updating threshold. Please try again.');
    }
  });

  // AI confidence settings menu
  bot.action('action_ai_confidence_menu', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const confidenceThresholds = resolveConfidenceThresholds(user.settings || {});

      const message = escapeMarkdownV2([
        '🧪 *AI Confidence Guard*',
        '',
        `Buy advice requires at least *${confidenceThresholds.buyNow}%* confidence.`,
        `Wait advice requires at least *${confidenceThresholds.wait}%* confidence.`,
        '',
        'Set a stricter value to reduce risky advice.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🟢 Set Buy Minimum', callback_data: 'action_set_ai_confidence_buy_now' }],
            [{ text: '🟡 Set Wait Minimum', callback_data: 'action_set_ai_confidence_wait' }],
            [{ text: '♻️ Reset to Defaults', callback_data: 'action_reset_ai_confidence' }],
            [{ text: '🔙 Back', callback_data: 'action_settings' }]
          ]
        }
      });
    } catch (error) {
      console.error('Error showing AI confidence settings:', error);
      await ctx.answerCbQuery('⚠️ Error loading AI confidence settings.');
    }
  });

  bot.action('action_set_ai_confidence_buy_now', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.SETTING_AI_CONFIDENCE_BUY_NOW);
      const message = escapeMarkdownV2([
        '🟢 *Set Buy Minimum Confidence*',
        '',
        'Send a number between 10 and 95.',
        'Example: `55` means Buy advice needs at least 55% confidence.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error setting Buy confidence threshold:', error);
      await ctx.answerCbQuery('⚠️ Error updating Buy confidence threshold.');
    }
  });

  bot.action('action_set_ai_confidence_wait', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.SETTING_AI_CONFIDENCE_WAIT);
      const message = escapeMarkdownV2([
        '🟡 *Set Wait Minimum Confidence*',
        '',
        'Send a number between 10 and 95.',
        'Example: `40` means Wait advice needs at least 40% confidence.'
      ].join('\n'));

      await safeEditMessageText(ctx, message, {
        parse_mode: 'MarkdownV2',
        ...backToMainKeyboard()
      });
    } catch (error) {
      console.error('Error setting Wait confidence threshold:', error);
      await ctx.answerCbQuery('⚠️ Error updating Wait confidence threshold.');
    }
  });

  bot.action('action_reset_ai_confidence', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      user.settings.aiConfidenceThresholds = { buyNow: null, wait: null };
      await user.save();

      await ctx.answerCbQuery('♻️ AI confidence guard reset to defaults');
      ctx.update.callback_query.data = 'action_ai_confidence_menu';
      return bot.handleUpdate(ctx.update);
    } catch (error) {
      console.error('Error resetting AI confidence thresholds:', error);
      await ctx.answerCbQuery('⚠️ Error resetting AI confidence thresholds.');
    }
  });
};
