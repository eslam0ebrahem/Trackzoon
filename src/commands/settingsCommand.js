import { UserService } from '../services/userService.js';
import { buildSettingsMessage } from '../utils/messageHelper.js';
import { resolveAdviceThresholds } from '../utils/adviceUtils.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('settings', async (ctx) => {
        try {
            const user = await UserService.getUserSettings(ctx.chat.id);
            const adviceThresholds = resolveAdviceThresholds(user.settings || {});

            const message = [
                '⚙️ *Settings*',
                '',
                '*Notification Settings*',
                `🔔 Price Alerts: ${user.settings.notifications ? 'Enabled' : 'Disabled'}`,
                `📊 Daily Reports: ${user.settings.dailyReport ? 'Enabled' : 'Disabled'}`,
                `🧠 Alert Sensitivity: ${user.settings.alertSensitivity || 'balanced'}`,
                `🎯 Auto Target: ${user.settings.autoTarget?.enabled ? 'Enabled' : 'Disabled'}`,
                `🔁 Watch Again: ${user.settings.watchAgain?.enabled ? 'Enabled' : 'Disabled'}`,
                `🎲 Drop Probability Alerts: ${user.settings.dropProbabilityAlerts?.enabled ? `On (${user.settings.dropProbabilityAlerts.threshold || 65}%)` : 'Off'}`,
                `🤖 AI Advice Thresholds: Buy ≥ ${adviceThresholds.buyNow} | Wait ≤ ${adviceThresholds.wait}`,
                '',
                '*Advanced Preferences*',
                `🌙 Quiet Mode: ${user.settings.quietMode?.enabled ? `On (${user.settings.quietMode.startHour}:00 - ${user.settings.quietMode.endHour}:00)` : 'Off'}`,
                `📉 Min Discount: ${user.settings.minDiscount > 0 ? user.settings.minDiscount + '%' : 'Any Drop'}`,
                '',
                'Click the buttons below to change settings:'
            ].join('\n');

            await ctx.reply(message, {
                parse_mode: 'Markdown',
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
                        ]
                    ]
                }
            });
        } catch (error) {
            handleError(ctx, error);
        }
    });
};
