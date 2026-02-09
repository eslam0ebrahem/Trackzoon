import { MessageBuilder } from '../utils/messageDesign.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError } from '../utils/errorHandler.js';

/**
 * /help command handler
 * Shows available commands and usage information
 */
export default (bot) => {
  bot.command('help', async (ctx) => {
    try {
      const builder = new MessageBuilder();
      builder.setHeader('Help Center', '📚');
      builder.addLine('I can help you track Amazon prices and save money! 💸');
      builder.addSpacer();

      builder.addSection('🚀 Getting Started');
      builder.addLine('1️⃣ Find a product on Amazon');
      builder.addLine('2️⃣ Share the link with me');
      builder.addLine('3️⃣ Set your target price');
      builder.addLine('4️⃣ Get notified when price drops!');
      builder.addSpacer();

      builder.addSection('📋 Available Commands');
      builder.addLine('`/add <link>` - Track a new product');
      builder.addLine('`/add_percentage <link> <percent>` - Track by % drop');
      builder.addLine('`/list` - View your tracked items');
      builder.addLine('`/deals` - See top price drops (24h)');
      builder.addLine('`/report` - Get daily price summary');
      builder.addLine('`/digest` - Smart portfolio digest');
      builder.addLine('`/insights <name/ASIN>` - Smart analytics for a product');
      builder.addLine('`/settings` - Configure your alerts');
      builder.addLine('`/help` - Show this help message');
      builder.addSpacer();

      builder.addSection('💡 Pro Tips');
      builder.addLine('• Just paste an Amazon link to track it instantly!');
      builder.addLine('• I check prices every 30 minutes');
      builder.addLine('• Enable daily reports to stay updated');
      builder.addLine('• Set realistic target prices for best results');
      builder.addSpacer();

      builder.addSection('🔔 Notifications');
      builder.addLine('You\'ll receive alerts when:');
      builder.addLine('  • Price drops below your target');
      builder.addLine('  • Product goes out of stock');
      builder.addLine('  • Product is back in stock');
      builder.addSpacer();

      builder.addTip('Use the menu below to get started!');

      await ctx.reply(builder.toString(), {
        parse_mode: 'Markdown',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });
};
