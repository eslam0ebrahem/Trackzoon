import Product from '../models/Product.js';
import User from '../models/User.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { buildPriceAlertMessage } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';
import pLimit from 'p-limit';
import { updateProductRating } from './ratingScraper.js';

import { logger } from '../utils/logger.js';
import { calculateVolatility } from '../utils/priceUtils.js';

// Rate limiter: Max 3 concurrent scraping requests to avoid IP bans
const scrapingLimit = pLimit(3);

export class PriceTrackerService {
  constructor(bot) {
    this.bot = bot;
  }

  async checkPrice(product) {
    try {
      let currentPrice;
      let imageUrl = null; // Declare in outer scope so it's available for all update operations
      const wasOutOfStock = product.isOutOfStock || false;
      const previousPrice = product.currentPrice;
      const asin = product.asin;

      try {
        const scrapeResult = await getPrice(product.url);
        currentPrice = scrapeResult.currentPrice;
        imageUrl = scrapeResult.imageUrl || null; // Optional field

        // Product is now available (no error thrown)
        if (wasOutOfStock) {
          logger.info(`Product ${product.asin} is now back in stock!`);

          // Check if product was actually tracked as in-stock before
          // (has real price history, not just added while out of stock)
          const hasBeenInStockBefore = product.priceHistory &&
            product.priceHistory.length > 0 &&
            product.outOfStockSince != null;

          // Only add to price history if price actually changed or this is first real price
          const shouldAddToHistory = !previousPrice ||
            previousPrice === 0 ||
            currentPrice !== previousPrice;

          // Atomic update to prevent race conditions
          const updateOps = {
            $set: {
              isOutOfStock: false,
              outOfStockSince: null,
              currentPrice: currentPrice,

              lastChecked: new Date(),
              ...(imageUrl && { imageUrl }) // Update image if found
            }
          };

          if (shouldAddToHistory) {
            updateOps.$push = {
              priceHistory: {
                price: currentPrice,
                date: new Date()
              }
            };
          }

          const updatedProduct = await Product.findOneAndUpdate(
            { asin: asin },
            updateOps,
            { new: true }
          );

          // Only notify if product was genuinely out of stock before
          // (not just added while unavailable) AND price is reasonable
          if (hasBeenInStockBefore) {
            // Notify users that product is back in stock (with cooldown check)
            for (const tracker of updatedProduct.trackedBy) {
              // Only send alert if price is at or below target price
              // No point alerting if it's too expensive anyway
              if (!tracker.thresholdPrice || currentPrice > tracker.thresholdPrice) {
                logger.info(`Skipping back-in-stock notification for user ${tracker.chatId} - price EGP${currentPrice} is above target EGP${tracker.thresholdPrice}`);
                continue;
              }

              // Check if we already notified recently (within 7 days to reduce spam)
              const shouldNotifyRestock = !tracker.lastAlertedAt ||
                (Date.now() - tracker.lastAlertedAt.getTime()) > 7 * 24 * 60 * 60 * 1000;

              if (shouldNotifyRestock) {
                await this.notifyBackInStock(tracker.chatId, updatedProduct, currentPrice, tracker.thresholdPrice);

                // Update lastAlertedAt atomically
                await Product.updateOne(
                  { asin: asin, 'trackedBy.chatId': tracker.chatId },
                  { $set: { 'trackedBy.$.lastAlertedAt': new Date() } }
                );
              } else {
                logger.info(`Skipping back-in-stock notification for user ${tracker.chatId} - already notified within 7 days`);
              }
            }
          } else {
            logger.info(`Product ${product.asin} is now available, but was added while out of stock - not sending back-in-stock alert`);
          }

          return {
            product: updatedProduct,
            previousPrice,
            currentPrice,
            wasOutOfStock: true
          };
        }

      } catch (priceError) {
        // Handle out-of-stock products gracefully (includes no-buybox)
        if (priceError.message.includes('out-of-stock') ||
          priceError.message.includes('third-party') ||
          priceError.message.includes('unavailable') ||
          priceError.message.includes('no-buybox')) {
          logger.info(`Product ${asin} is out of stock, skipping price check`);

          // Mark as out of stock if not already (atomic update)
          if (!wasOutOfStock) {
            await Product.findOneAndUpdate(
              { asin: asin },
              {
                $set: {
                  isOutOfStock: true,
                  outOfStockSince: new Date(),
                  lastChecked: new Date()
                }
              }
            );
            logger.info(`Marked product ${asin} as out of stock`);
          } else {
            // Just update lastChecked
            await Product.findOneAndUpdate(
              { asin: asin },
              { $set: { lastChecked: new Date() } }
            );
          }
          return null; // Skip this product without failing the entire check
        }
        throw priceError; // Re-throw other errors
      }

      // No price change
      if (currentPrice === previousPrice) {
        // Still recalculate volatility to allow products to "cool down"
        // If price hasn't changed in a while, the score should drop and interval increase
        const { score: volatilityScore, interval: checkInterval } = calculateVolatility(product.priceHistory);

        await Product.findOneAndUpdate(
          { asin: asin },
          {
            $set: {
              lastChecked: new Date(),
              volatilityScore,
              checkInterval
            }
          }
        );
        return null;
      }

      // Calculate new volatility score
      const newHistory = [...product.priceHistory, { price: currentPrice, date: new Date() }];
      const { score: volatilityScore, interval: checkInterval } = calculateVolatility(newHistory);

      // Price changed - atomic update with history push and volatility update
      const updatedProduct = await Product.findOneAndUpdate(
        { asin: asin },
        {
          $push: {
            priceHistory: {
              price: currentPrice,
              date: new Date()
            }
          },
          $set: {
            currentPrice: currentPrice,

            lastChecked: new Date(),
            volatilityScore,
            checkInterval,
            ...(imageUrl && { imageUrl })
          }
        },
        { new: true }
      );

      // Check thresholds and notify users
      for (const tracker of updatedProduct.trackedBy) {
        const shouldNotify = await this.shouldNotifyUser(tracker, previousPrice, currentPrice);

        if (shouldNotify) {
          await this.notifyUser(tracker.chatId, updatedProduct, previousPrice, currentPrice);

          // Update last alerted time atomically
          await Product.updateOne(
            { asin: asin, 'trackedBy.chatId': tracker.chatId },
            { $set: { 'trackedBy.$.lastAlertedAt': new Date() } }
          );
        }
      }

      return {
        product: updatedProduct,
        previousPrice,
        currentPrice
      };
    } catch (error) {
      logger.error(`Error checking price for product ${product.asin}:`, error);
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

      if (product.imageUrl) {
        await this.bot.telegram.sendPhoto(chatId, product.imageUrl, {
          caption: message,
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 Buy Now', url: product.url }],
              [{ text: '📈 View Chart', callback_data: `action_chart_${product.asin}` }]
            ]
          }
        });
      } else {
        await sendMessageWithRetry(this.bot, chatId, message, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false
        });
      }
    } catch (error) {
      logger.error(`Error notifying user ${chatId} about product ${product.asin}:`, error);
      // Don't throw - continue processing other notifications
    }
  }

  async notifyBackInStock(chatId, product, currentPrice, thresholdPrice) {
    try {
      const { escapeMarkdownV2 } = await import('../utils/messageHelper.js');

      // At this point, price is always at or below threshold (checked before calling)
      const savings = thresholdPrice - currentPrice;
      const percentSavings = ((savings / thresholdPrice) * 100).toFixed(1);

      const message = [
        '🎉 *Back in Stock at Great Price\\!*',
        '',
        `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
        '',
        '✅ This product is now available and within your budget\\!',
        '',
        `💰 *Current Price:* EGP${escapeMarkdownV2(currentPrice.toFixed(2))}`,
        `🎯 *Your Target:* EGP${escapeMarkdownV2(thresholdPrice.toFixed(2))}`,
        '',
        savings > 0
          ? `🎊 *Great Deal\\!* You save EGP${escapeMarkdownV2(savings.toFixed(2))} \\(${escapeMarkdownV2(percentSavings)}% below target\\)\\!`
          : `✨ *Perfect Price\\!* Exactly at your target\\!`,
        '',
        '🛒 Click the product name above to buy now before it sells out again\\!'
      ].join('\n');

      await sendMessageWithRetry(this.bot, chatId, message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false
      });
    } catch (error) {
      logger.error(`Error notifying user ${chatId} about back-in-stock for ${product.asin}:`, error);
      // Don't throw - continue processing other notifications
    }
  }

  async checkAllPrices() {
    const products = await Product.find({});
    logger.info(`Checking prices for ${products.length} products...`);

    // Use rate limiter to batch requests (3 concurrent max)
    const results = await Promise.allSettled(
      products.map(product => scrapingLimit(() => this.checkPrice(product)))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const unchanged = results.filter(r => r.status === 'fulfilled' && !r.value).length;

    logger.info(`Price check completed:
      - ${succeeded} prices updated
      - ${unchanged} prices unchanged
      - ${failed} checks failed`);

    // After price checks, scan for flash deals (async, don't block)
    this.scanForFlashDeals().catch(err =>
      logger.error('Error scanning for flash deals:', err)
    );

    // Update ratings for a few products (async, don't block)
    this.updateSomeRatings().catch(err =>
      logger.error('Error updating ratings:', err)
    );

    return {
      succeeded,
      unchanged,
      failed
    };
  }

  /**
   * Scan for flash deals after price checks
   */
  async scanForFlashDeals() {
    // Flash deals feature has been removed
    logger.info('⚠️ Flash deals feature is disabled');
    return 0;
  }

  /**
   * Update ratings for a subset of products (to avoid overwhelming the scraper)
   */
  async updateSomeRatings() {
    try {
      logger.info('⭐ Updating product ratings...');

      // Get products that need rating updates (no rating or >7 days old)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const products = await Product.find({
        'trackedBy.0': { $exists: true },
        isOutOfStock: false,
        $or: [
          { 'rating.lastUpdated': { $exists: false } },
          { 'rating.lastUpdated': { $lt: sevenDaysAgo } }
        ]
      }).limit(5); // Only update 5 products per run to avoid rate limiting

      let updated = 0;
      for (const product of products) {
        try {
          await updateProductRating(product);
          updated++;
          // Add delay between requests
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          logger.error(`Error updating rating for ${product.name}:`, error.message);
        }
      }

      logger.info(`✅ Updated ${updated} product ratings.`);
      return updated;

    } catch (error) {
      logger.error('Error in updateSomeRatings:', error);
      return 0;
    }
  }
}