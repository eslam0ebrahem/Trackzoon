import { resolveAmazonUrl } from '../utils/url.js';
import { ProductService } from '../services/productService.js';
import { validatePercentage } from '../utils/productTracker.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  bot.command('add_percentage', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        return await ctx.reply(
          'Usage: /add\\_percentage <Amazon product URL> <percentage>\n\n' +
          'Example: /add\\_percentage https://amazon.com/dp/XXXXXX 20',
          { parse_mode: 'MarkdownV2' }
        );
      }

      let [, url, percentageStr] = parts;

      // Validate and parse percentage first
      const percentage = validatePercentage(percentageStr);
      if (!percentage) {
        return await ctx.reply('Please provide a valid percentage between 1 and 99.');
      }

      await ctx.reply('Processing your request...');

      try {
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          return await ctx.reply('Please provide a valid Amazon product URL.');
        }

        const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(
          resolvedUrl,
          ctx.chat.id,
          0,
          { alertType: 'percentage', percentageThreshold: percentage }
        );

        const updatedProduct = isAlreadyTracked
          ? await ProductService.updatePercentageThreshold(asin, ctx.chat.id, percentage)
          : product;

        const baseline = updatedProduct.currentUserSubscription?.baselinePrice || updatedProduct.currentPrice || 0;
        const targetPrice = baseline > 0
          ? (baseline * (1 - percentage / 100))
          : null;

        const message = isAlreadyTracked || !isNew
          ? `✅ Updated price tracker for ${escapeMarkdownV2(updatedProduct.name)}\n\n` +
            `Current Price: EGP${baseline.toFixed(2)}\n` +
            `New alert: ${percentage}% drop${targetPrice ? ` (EGP${targetPrice.toFixed(2)})` : ''}`
          : `✅ Added price tracker for ${escapeMarkdownV2(updatedProduct.name)}\n\n` +
            `Current Price: EGP${baseline.toFixed(2)}\n` +
            `Alert at: ${percentage}% drop${targetPrice ? ` (EGP${targetPrice.toFixed(2)})` : ''}`;

        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        console.error('Error in add_percentage command:', error);
        await ctx.reply('Error adding the product. Please try again.');
      }
    } catch (error) {
      console.error('Unexpected error in add_percentage command:', error);
      await ctx.reply('An unexpected error occurred. Please try again.');
    }
  });
};
