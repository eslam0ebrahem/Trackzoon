// bot/commands/settings.js

export default (bot) => {
  bot.command('settings', (ctx) => {
    const message = '⚙️ Your Settings\n\n' +
      'Use the buttons below to manage your notification preferences.';

    ctx.reply(message, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔔 Notification Settings', callback_data: 'toggle_notifications' }],
        ],
      },
      parse_mode: 'Markdown'
    });
  });
};
