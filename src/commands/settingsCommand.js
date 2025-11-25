import { UserService } from '../services/userService.js';
import { buildSettingsMessage } from '../utils/messageHelper.js';
import { handleError } from '../utils/errorHandler.js';

export default (bot) => {
    bot.command('settings', async (ctx) => {
        try {
            const user = await UserService.getUserSettings(ctx.chat.id);

            const message = [
                '⚙️ *Settings*',
                '',
                '*Notification Settings*',
                `🔔 Price Alerts: ${user.settings.notifications ? 'Enabled' : 'Disabled'}`,
                `📊 Daily Reports: ${user.settings.dailyReport ? 'Enabled' : 'Disabled'}`,
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
                                text: '📉 Set Min Discount',
                                callback_data: 'action_set_min_discount'
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
