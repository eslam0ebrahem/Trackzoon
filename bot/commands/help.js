import commands from './commandList.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.command('help', (ctx) => {
    const helpMessage = [
      '*Available Commands:*',
      '',
      '*Basic Commands:*',
      '/start \\- Start the bot',
      '/help \\- Show this help message',
      '/settings \\- Configure your preferences',
      '',
      '*Product Management:*',
      '/add \\- Add a new product to track',
      '/list \\- View all tracked products',
      '/view \\- View details of a specific product',
      '/remove \\- Stop tracking a product',
      '',
      '*Price Alerts:*',
      '/setthreshold \\- Set price alert threshold',
      '/history \\- View price history',
      '',
      '*Tips:*',
      '• Send an Amazon link directly to add a product',
      '• Use inline buttons for quick actions',
      '• Check /list regularly for price updates'
    ].join('\n');

    ctx.reply(escapeMarkdownV2(helpMessage), {
      parse_mode: 'MarkdownV2'
    });
  });
};
