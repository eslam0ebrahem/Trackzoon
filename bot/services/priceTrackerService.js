import Product from '../models/Product.js';
import { getPrice } from '../../src/lib/scraper/getPrice.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { buildPriceAlertMessage } from '../utils/messageHelper.js';

export class PriceTrackerService {
  constructor(bot) {
    this.bot = bot;
  }

  async checkPrice(product) {
    try {
      const currentPrice = await getPrice(product.url);
      const previousPrice = product.currentPrice;

      if (currentPrice === previousPrice) {
        return null;
      }

      // Update price history and current price
      product.priceHistory.push({
        price: currentPrice,
        date: new Date()
      });
      product.currentPrice = currentPrice;
      await product.save();

      // Check thresholds and notify users
      for (const tracker of product.trackedBy) {
        if (
          (previousPrice > tracker.thresholdPrice && currentPrice <= tracker.thresholdPrice) ||
          (Math.abs((currentPrice - previousPrice) / previousPrice) >= 0.1) // 10% change
        ) {
          await this.notifyUser(tracker.chatId, product, previousPrice, currentPrice);
        }
      }

      return {
        product,
        previousPrice,
        currentPrice
      };
    } catch (error) {
      console.error(`Error checking price for product ${product.asin}:`, error);
      throw new BotError(
        'Failed to check price',
        ErrorCodes.SCRAPING_ERROR,
        'Failed to check product price'
      );
    }
  }

  async notifyUser(chatId, product, oldPrice, newPrice) {
    try {
      const message = buildPriceAlertMessage(product, oldPrice, newPrice);
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false
      });
    } catch (error) {
      console.error(`Error notifying user ${chatId} about product ${product.asin}:`, error);
    }
  }

  async checkAllPrices() {
    const products = await Product.find({});
    console.log(`Checking prices for ${products.length} products...`);

    const results = await Promise.allSettled(
      products.map(product => this.checkPrice(product))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const unchanged = results.filter(r => r.status === 'fulfilled' && !r.value).length;

    console.log(`Price check completed:
      - ${succeeded} prices updated
      - ${unchanged} prices unchanged
      - ${failed} checks failed`);

    return {
      succeeded,
      unchanged,
      failed
    };
  }
}