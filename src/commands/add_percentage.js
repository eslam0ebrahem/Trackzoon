import { resolveAmazonUrl } from '../utils/url.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { addPriceTracker, validatePercentage } from '../utils/productTracker.js';

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
        // Resolve and validate URL
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          return await ctx.reply('Please provide a valid Amazon product URL.');
        }
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        const scrapeResult = await getPrice(resolvedUrl).catch(() => ({ price: 0 }));
        const currentPrice = scrapeResult.price;

        if (currentPrice <= 0) {
          return await ctx.reply('Unable to fetch the current price. Please try again later.');
        }

        // Add or update tracker
        const { product, isNew } = await addPriceTracker({
          asin,
          url: resolvedUrl,
          chatId: ctx.chat.id,
          threshold: percentage,
          currentPrice,
          name,
          isPercentage: true
        });

        const thresholdPrice = currentPrice * (1 - percentage / 100);

        const message = isNew
          ? `✅ Added price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
          `Current Price: EGP${currentPrice.toFixed(2)}\n` +
          `Alert at: ${percentage}% drop (EGP${thresholdPrice.toFixed(2)})`
          : `✅ Updated price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
          `Current Price: EGP${currentPrice.toFixed(2)}\n` +
          `New alert: ${percentage}% drop (EGP${thresholdPrice.toFixed(2)})`;

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
