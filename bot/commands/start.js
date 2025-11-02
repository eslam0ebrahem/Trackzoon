import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { Messages } from '../utils/messages.js';

export default (bot) => {
  bot.command('start', (ctx) => {
    const text = escapeMarkdownV2(Messages.startMessage);
    ctx.replyWithMarkdownV2(text, {
      reply_markup: {
        inline_keyboard: [
          [{ text: Messages.addCommand, callback_data: 'add_product' }],
          [{ text: Messages.listCommand, callback_data: 'list_products' }],
          [{ text: Messages.helpCommand, callback_data: 'show_help' }],
        ],
      },
    });
  });
};
