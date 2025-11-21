import { ProductService } from '../services/productService.js';
import { stateManager, BotStates } from '../utils/stateManager.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { resolveAmazonUrl } from '../utils/url.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { BotError, ErrorCodes, handleError } from '../utils/errorHandler.js';

/**
 * /add command handler
 * Add a new product to track with price alert
 */
export default (bot) => {
  bot.command('add', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        // Prompt for URL and price
        stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL_AND_PRICE);
        const message = [
          '🛍️ *Track a New Product*',
          '',
          '📝 *Send me:*',
          '`<Amazon URL> <alert price>`',
          '',
          '💡 *Examples:*',
          '• `https://amzn\\.to/xxx 99\\.99`',
          '• `https://amazon\\.co\\.uk/dp/B085P5NY9H 68`',
          '',
          '⚡ *One step \\- that\'s it\\!*'
        ].join('\n');

        return await ctx.reply(message, {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      let [, url, thresholdStr] = parts;
      const threshold = parseFloat(thresholdStr);
      if (isNaN(threshold) || threshold <= 0) {
        return await ctx.reply(
          escapeMarkdownV2('❌ Please provide a valid price (a positive number).'),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }

      const processingMsg = await ctx.reply(
        '🔄 *Processing\\.\\.\\.*\n\nFetching product details\\.\\.\\.',
        { parse_mode: 'MarkdownV2' }
      );

      try {
        // Clean and validate URL
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });
          return await ctx.reply(
            escapeMarkdownV2('❌ Invalid Amazon URL. Please provide a valid product link.'),
            { parse_mode: 'MarkdownV2', ...mainKeyboard() }
          );
        }

        // Get product details
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        let currentPrice;
        let isOutOfStock = false;

        try {
          const scrapeResult = await getPrice(resolvedUrl);
          currentPrice = scrapeResult.price;
        } catch (priceError) {
          // Check if it's an out-of-stock error
          if (priceError.message.includes('out of stock') || priceError.message.includes('unavailable')) {
            console.log(`Product ${asin} is out of stock, using threshold as placeholder`);
            currentPrice = threshold;
            isOutOfStock = true;
          } else {
            throw priceError;
          }
        }

        // Add product
        const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(
          resolvedUrl,
          ctx.chat.id,
          threshold
        );

        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

        if (isAlreadyTracked) {
          const message = [
            '⚠️ *Already Tracking*',
            '',
            `📦 [${escapeMarkdownV2(name)}](${escapeMarkdownV2(resolvedUrl)})`,
            '',
            `You're already tracking this product\\!`,
            '',
            `💡 Use /list to see all your products`
          ].join('\n');

          return await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: false,
            ...mainKeyboard()
          });
        }

        const statusEmoji = isOutOfStock ? '📭' : '✅';
        const statusText = isOutOfStock
          ? 'Currently out of stock \\- we\'ll notify you when it\'s back\\!'
          : 'Tracking active\\!';

        const message = [
          `${statusEmoji} *${isNew ? 'Product Added' : 'Tracking Started'}*`,
          '',
          `📦 [${escapeMarkdownV2(name)}](${escapeMarkdownV2(resolvedUrl)})`,
          '',
          `💵 *Current Price:* £${escapeMarkdownV2(currentPrice.toFixed(2))}`,
          `🎯 *Alert Price:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
          '',
          `${statusText}`,
          '',
          '✨ You can view all your tracked products anytime with /list'
        ].join('\n');

        await ctx.reply(message, {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard(),
          disable_web_page_preview: true
        });

      } catch (innerError) {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

        if (innerError instanceof BotError && innerError.code === 'PRODUCT_ALREADY_TRACKED') {
          return await ctx.reply(
            escapeMarkdownV2('❌ You are already tracking this product.'),
            { parse_mode: 'MarkdownV2', ...mainKeyboard() }
          );
        }
        console.error('Error in add command:', innerError);
        await ctx.reply(
          escapeMarkdownV2('❌ Error adding the product. Please try again.'),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }
    } catch (error) {
      console.error('Unexpected error in add command:', error);
      await ctx.reply(
        escapeMarkdownV2('❌ An unexpected error occurred. Please try again.'),
        { parse_mode: 'MarkdownV2', ...mainKeyboard() }
      );
    }
  });
};
