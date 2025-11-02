import { resolveAmazonUrl } from '../utils/url.js';
import { getProductName } from '../../src/lib/scraper/getProductName.js';
import { getPrice } from '../../src/lib/scraper/getPrice.js';
import { addPriceTracker, validateThreshold } from '../utils/productTracker.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot, addingProductState) => {
  bot.command('add', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        addingProductState.set(ctx.chat.id, { step: 'waiting_for_url', data: {} });
        return await ctx.reply(
          'Please provide the Amazon product URL and your desired price alert threshold\\.\n\n' +
          'Usage: /add <Amazon URL> <price threshold>\n' +
          'Example: /add https://amazon\\.com/dp/XXXXXX 299\\.99',
          { parse_mode: 'MarkdownV2' }
        );
      }

      let [, url, thresholdStr] = parts;
      const threshold = validateThreshold(thresholdStr);
      if (!threshold) {
        return await ctx.reply(
          'Please provide a valid price threshold \\(a positive number\\)\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      await ctx.reply(
        'Processing your request\\.\\.\\.',
        { parse_mode: 'MarkdownV2' }
      );

      try {
        // Clean and validate URL
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          return await ctx.reply(
            'Please provide a valid Amazon product URL\\.',
            { parse_mode: 'MarkdownV2' }
          );
        }

        // Get product details
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        const currentPrice = await getPrice(resolvedUrl).catch(() => 0);

        if (currentPrice <= 0) {
          return await ctx.reply(
            'Unable to fetch the current price\\. Please try again later\\.',
            { parse_mode: 'MarkdownV2' }
          );
        }

        // Add or update tracker
        const { product, isNew } = await addPriceTracker({
          asin,
          url: resolvedUrl,
          chatId: ctx.chat.id,
          threshold,
          currentPrice,
          name,
          isPercentage: false
        });

        // Show confirmation with current price context
        const message = isNew
          ? `✅ Added price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: €${currentPrice.toFixed(2)}\n` +
            `Alert Price: €${threshold.toFixed(2)}`
          : `✅ Updated price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: €${currentPrice.toFixed(2)}\n` +
            `New Alert Price: €${threshold.toFixed(2)}`;

        await ctx.reply(
          escapeMarkdownV2(message),
          { parse_mode: 'MarkdownV2' }
        );
      } catch (error) {
        console.error('Error in add command:', error);
        await ctx.reply(
          'Error adding the product\\. Please try again\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (error) {
      console.error('Unexpected error in add command:', error);
      await ctx.reply(
        'An unexpected error occurred\\. Please try again\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  });
};
