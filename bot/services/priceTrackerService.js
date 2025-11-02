import Product from '../models/Product.js';
import User from '../models/User.js';
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
    
    // Get user's minimum price drop setting
    let minPriceDrop = 10; // Default 10%
    try {
      const user = await User.findOne({ chatId: tracker.chatId.toString() });
      if (user && user.settings && user.settings.minPriceDrop !== undefined) {
        minPriceDrop = user.settings.minPriceDrop;
      }
    } catch (error) {
      console.error('Error getting user settings:', error);
    }
    
    // Always notify if threshold is met (regardless of minimum drop)
    if (tracker.thresholdPrice && oldPrice > tracker.thresholdPrice && newPrice <= tracker.thresholdPrice) {
      return true;
    }
    
    // Check if price drop meets minimum threshold
    if (isDecrease && Math.abs(priceChange) >= minPriceDrop) {
      return true;
    }
    
    // Notify on any price drop if close to threshold (within 5%)
    if (tracker.thresholdPrice && isDecrease) {
      const percentFromThreshold = ((newPrice - tracker.thresholdPrice) / tracker.thresholdPrice) * 100;
      if (percentFromThreshold <= 5 && Math.abs(priceChange) >= (minPriceDrop / 2)) {
        // Lower threshold when close to target (half of minPriceDrop)
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