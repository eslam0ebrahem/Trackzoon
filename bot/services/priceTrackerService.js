import Product from '../models/Product.js';
import User from '../models/User.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { buildPriceAlertMessage } from '../utils/messageHelper.js';

export class PriceTrackerService {
  constructor(bot) {
    this.bot = bot;
  }

  async checkPrice(product) {
    try {
      let currentPrice;
      
      try {
        currentPrice = await getPrice(product.url);
      } catch (priceError) {
        // Handle out-of-stock products gracefully
        if (priceError.message.includes('out of stock') || priceError.message.includes('unavailable')) {
          console.log(`Product ${product.asin} is out of stock, skipping price check`);
          product.lastChecked = new Date();
          await product.save();
          return null; // Skip this product without failing the entire check
        }
        throw priceError; // Re-throw other errors
      }
      
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
      product.lastChecked = new Date();
      await product.save();

      // Check thresholds and notify users
      for (const tracker of product.trackedBy) {
        const shouldNotify = await this.shouldNotifyUser(tracker, previousPrice, currentPrice);
        
        if (shouldNotify) {
          await this.notifyUser(tracker.chatId, product, previousPrice, currentPrice);
          
          // Update last alerted time to prevent spam
          tracker.lastAlertedAt = new Date();
        }
      }
      
      // Save updated tracker info
      await product.save();

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

  async shouldNotifyUser(tracker, oldPrice, newPrice) {
    const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
    const isDecrease = newPrice < oldPrice;
    
    // Don't spam - wait at least 3 hours between alerts for the same product
    if (tracker.lastAlertedAt) {
      const hoursSinceLastAlert = (Date.now() - tracker.lastAlertedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAlert < 3) {
        return false;
      }
    }
    
    // Always notify if threshold is met
    if (tracker.thresholdPrice && oldPrice > tracker.thresholdPrice && newPrice <= tracker.thresholdPrice) {
      return true;
    }
    
    // Check if price drop is significant (>= 10%)
    if (isDecrease && Math.abs(priceChange) >= 10) {
      return true;
    }
    
    // Notify on any price drop if close to threshold (within 5%)
    if (tracker.thresholdPrice && isDecrease) {
      const percentFromThreshold = ((newPrice - tracker.thresholdPrice) / tracker.thresholdPrice) * 100;
      if (percentFromThreshold <= 5 && Math.abs(priceChange) >= 5) {
        // Lower threshold when close to target (5% minimum)
        return true;
      }
    }
    
    return false;
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