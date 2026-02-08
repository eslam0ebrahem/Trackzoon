import { ProductService } from '../services/productService.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { resolveAmazonUrl } from '../utils/url.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { BotError, ErrorCodes, handleError } from '../utils/errorHandler.js';
import { UserService } from '../services/userService.js';

/**
 * /add command handler
 * Add a new product to track with price alert
 */
export default (bot) => {
  bot.command('add', async (ctx) => {
    try {
      const input = ctx.message.text.replace('/add', '').trim();
      const user = await UserService.getUserSettings(ctx.chat.id);
      const autoTargetEnabled = user.settings.autoTarget?.enabled;
      const autoTargetStyle = user.settings.alertSensitivity || 'balanced';

      if (!input) {
        // Prompt for URL and price
        stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL_AND_PRICE);
        const message = [
          '🛍️ *Track New Products*',
          '',
          '📝 *Send me one or more links:*',
          '`<Amazon URL> <alert price>`',
          autoTargetEnabled ? '🧠 *Auto Target is enabled:* You can send URL only.' : '',
          '',
          '💡 *Bulk Add Example:*',
          '`https://amzn.to/item1 100`',
          '`https://amzn.to/item2 250`',
          '',
          '⚡ *Send multiple lines to add them all at once!*'
        ].join('\n');

        return await ctx.reply(message, {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      // Split by newline to handle bulk import
      const lines = input.split('\n').filter(line => line.trim());
      const results = [];

      const processingMsg = await ctx.reply(
        `🔄 *Processing ${lines.length} product\\(s\\)\\.\\.\\.*`,
        { parse_mode: 'MarkdownV2' }
      );

      for (const line of lines) {
        try {
          const parts = line.trim().split(/\s+/);
          const url = parts[0];
          const thresholdStr = parts[1];
          const threshold = thresholdStr ? parseFloat(thresholdStr) : 0; // Default to 0 if not provided

          if (!thresholdStr && !autoTargetEnabled) {
            results.push(`❌ Missing price for: ${url.substring(0, 30)}...`);
            continue;
          }

          // Clean and validate URL
          const { resolvedUrl, asin } = await resolveAmazonUrl(url);
          if (!asin) {
            results.push(`❌ Invalid URL: ${url.substring(0, 30)}...`);
            continue;
          }

          // Get product details
          const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
          let currentPrice;
          let isOutOfStock = false;

          try {
            const scrapeResult = await getPrice(resolvedUrl);
            currentPrice = scrapeResult.currentPrice;
          } catch (priceError) {
            if (priceError.message.includes('out of stock') || priceError.message.includes('unavailable')) {
              currentPrice = threshold > 0 ? threshold : 0;
              isOutOfStock = true;
            } else {
              results.push(`❌ Error fetching price for ${asin}`);
              continue;
            }
          }

          // Add product
          const useAutoTarget = (!thresholdStr || threshold <= 0) && autoTargetEnabled;
          const { isNew, isAlreadyTracked, autoTargetApplied, autoTargetPrice } = await ProductService.addProduct(
            resolvedUrl,
            ctx.chat.id,
            threshold,
            {
              autoTarget: useAutoTarget,
              autoTargetStyle
            }
          );

          if (isAlreadyTracked) {
            results.push(`⚠️ Already tracking: [${name.substring(0, 20)}...]`);
          } else {
            const autoNote = autoTargetApplied && autoTargetPrice
              ? ` (Auto target: EGP ${autoTargetPrice.toFixed(2)})`
              : '';
            results.push(`✅ Added: [${name.substring(0, 20)}...] (EGP ${currentPrice})${autoNote}`);
          }

        } catch (err) {
          console.error('Error processing line:', line, err);
          results.push(`❌ Failed: ${line.substring(0, 30)}...`);
        }
      }

      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

      // Send summary
      const summary = [
        '📋 *Bulk Add Results*',
        '',
        ...results,
        '',
        '✨ Use /list to view all products'
      ].join('\n');

      await ctx.reply(escapeMarkdownV2(summary), {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...mainKeyboard()
      });

    } catch (error) {
      console.error('Unexpected error in add command:', error);
      await ctx.reply(
        escapeMarkdownV2('❌ An unexpected error occurred. Please try again.'),
        { parse_mode: 'MarkdownV2', ...mainKeyboard() }
      );
    }
  });
};
