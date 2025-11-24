import Product from '../models/Product.js';
import User from '../models/User.js';
import SystemMetric from '../models/SystemMetric.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { buildPriceAlertMessage } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';
import { sendWebhook } from './webhookService.js';
import pLimit from 'p-limit';
import { updateProductRating } from './ratingScraper.js';

import { logger } from '../utils/logger.js';
import { calculateVolatility, calculatePriceStats, calculateDealScore, predictPriceTrend } from '../utils/priceUtils.js';

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
      let scrapeResult = null; // Declare in outer scope
      const wasOutOfStock = product.isOutOfStock || false;
      const previousPrice = product.currentPrice;
      const asin = product.asin;

      try {
        scrapeResult = await getPrice(product.url);
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
              ...(imageUrl && { imageUrl }), // Update image if found
              // Update enhanced fields
              ...(scrapeResult.merchant && { merchant: scrapeResult.merchant }),
              ...(scrapeResult.prime !== undefined && { prime: scrapeResult.prime }),
              ...(scrapeResult.delivery && { delivery: scrapeResult.delivery }),
              ...(scrapeResult.coupon && { coupon: scrapeResult.coupon }),
              ...(scrapeResult.dealProgress && { dealProgress: scrapeResult.dealProgress }),
              ...(scrapeResult.otherSellers && { otherSellers: scrapeResult.otherSellers })
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

          // Add to stock history (Back in Stock)
          if (!updateOps.$push) updateOps.$push = {};
          updateOps.$push.stockHistory = {
            status: 'in_stock',
            date: new Date()
          };

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
                },
                $push: {
                  stockHistory: {
                    status: 'out_of_stock',
                    date: new Date()
                  }
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
        // Even if price didn't change, we should update Smart Score and Volatility
        // This ensures imported products or those with missing scores get updated

        const { score: volatilityScore, interval: checkInterval } = calculateVolatility(product.priceHistory);

        // Calculate 30-day stats for score calculation
        const stats30d = calculatePriceStats(product.priceHistory, 30);
        const trend = predictPriceTrend(product.priceHistory);

        // Calculate Smart Score (0-100) using robust utility
        const smartScore = calculateDealScore(
          currentPrice,
          stats30d,
          volatilityScore,
          false, // isOutOfStock
          trend
        );

        // Determine Label for stable price
        let dealLabel = 'fair_price';
        if (smartScore >= 80) dealLabel = 'hot_deal';
        else if (smartScore >= 60) dealLabel = 'good_deal';
        else if (volatilityScore < 3) dealLabel = 'stable';

        await Product.findOneAndUpdate(
          { asin: asin },
          {
            $set: {
              lastChecked: new Date(),
              volatilityScore,
              checkInterval,
              smartScore,
              dealLabel,
              // Ensure other smart fields are present
              ...(scrapeResult.merchant && { merchant: scrapeResult.merchant }),
              ...(scrapeResult.prime !== undefined && { prime: scrapeResult.prime }),
              ...(scrapeResult.delivery && { delivery: scrapeResult.delivery }),
              ...(scrapeResult.coupon && { coupon: scrapeResult.coupon }),
              ...(scrapeResult.dealProgress && { dealProgress: scrapeResult.dealProgress }),
              ...(scrapeResult.otherSellers && { otherSellers: scrapeResult.otherSellers })
            }
          }
        );
        return false;
      }

      // Calculate new volatility score
      const newHistory = [...product.priceHistory, { price: currentPrice, date: new Date() }];
      const { score: volatilityScore, interval: checkInterval } = calculateVolatility(newHistory);

      // --- SMART METRICS CALCULATION (Write-Time) ---
      const priceChangePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
      const isDrop = priceChangePercent < 0;

      // Calculate 30-day stats for score calculation
      const stats30d = calculatePriceStats(product.priceHistory, 30);
      const trend = predictPriceTrend(product.priceHistory);

      // 1. Calculate Algorithmic Score (Baseline)
      let smartScore = calculateDealScore(
        currentPrice,
        stats30d,
        volatilityScore,
        false, // isOutOfStock
        trend
      );

      // 2. AI Analysis (Pure AI Scoring)
      // Trigger if:
      // - Price drop > 3% (More sensitive)
      // - OR Analysis is older than 7 days
      const daysSinceAnalysis = product.lastAiAnalysis
        ? (Date.now() - new Date(product.lastAiAnalysis).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      let aiAnalysisResult = null;

      if ((isDrop && Math.abs(priceChangePercent) > 3) || daysSinceAnalysis > 7) {
        try {
          // Import dynamically to avoid circular deps if any
          const { aiService } = await import('./aiService.js');

          // Calculate days tracked to identify true "new" products vs stable ones
          const firstPriceDate = product.priceHistory.length > 0
            ? new Date(product.priceHistory[0].date)
            : new Date();
          const daysTracked = (Date.now() - firstPriceDate.getTime()) / (1000 * 60 * 60 * 24);

          // Pass rich context to AI
          const aiResult = await aiService.analyzeDeal({
            ...product.toObject(),
            currentPrice,
            stats: stats30d,
            priceChange: priceChangePercent.toFixed(2),
            trend: trend.trend,
            volatility: daysTracked < 7
              ? 'New Product (Insufficient Data)'
              : (volatilityScore >= 8 ? 'High' : volatilityScore >= 4 ? 'Medium' : 'Stable')
          });

          if (aiResult) {
            aiAnalysisResult = aiResult;

            // Pure AI Score
            smartScore = aiResult.score;
            logger.info(`🤖 AI Analysis for ${asin}: Pure AI Score = ${smartScore}`);
          }
        } catch (err) {
          logger.error('Failed to run AI analysis:', err);
        }
      }

      // 3. AI Price Prediction (Enhancement)
      // Run prediction if missing or older than 3 days
      let aiPredictionResult = null;
      const daysSincePrediction = product.aiPrediction?.lastUpdated
        ? (Date.now() - new Date(product.aiPrediction.lastUpdated).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      if (daysSincePrediction > 3 && product.priceHistory.length >= 5) {
        try {
          const { aiService } = await import('./aiService.js');
          const prediction = await aiService.predictTrend({
            ...product.toObject(),
            currentPrice,
            priceHistory: product.priceHistory // Ensure history is passed
          });

          if (prediction) {
            aiPredictionResult = prediction;
            logger.info(`🔮 AI Prediction for ${asin}: ${prediction.trend} (${prediction.confidence})`);
          }
        } catch (err) {
          logger.warn('AI Prediction failed:', err.message);
        }
      }

      // Determine Label based on Score
      let dealLabel = 'fair_price';
      if (smartScore >= 80) dealLabel = 'hot_deal';
      else if (smartScore >= 60) dealLabel = 'good_deal';
      else if (priceChangePercent > 0) dealLabel = 'price_hike';
      else if (volatilityScore < 3) dealLabel = 'stable';

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

            // New Smart Fields
            smartScore,
            dealLabel,
            discountPercentage: priceChangePercent,
            ...(isDrop && { lastDropDate: new Date() }), // Only update drop date on drops

            lastPriceChange: {
              date: new Date(),
              oldPrice: previousPrice,
              newPrice: currentPrice,
              diff: currentPrice - previousPrice,
              percent: priceChangePercent
            },

            // AI Fields
            ...(aiAnalysisResult && {
              aiAnalysis: aiAnalysisResult.reason,
              lastAiAnalysis: new Date()
            }),

            // AI Prediction
            ...(aiPredictionResult && {
              aiPrediction: {
                ...aiPredictionResult,
                lastUpdated: new Date()
              }
            }),

            ...(imageUrl && { imageUrl }),
            // Update enhanced fields (using scrapeResult)
            ...(scrapeResult.merchant && { merchant: scrapeResult.merchant }),
            ...(scrapeResult.prime !== undefined && { prime: scrapeResult.prime }),
            ...(scrapeResult.delivery && { delivery: scrapeResult.delivery }),
            ...(scrapeResult.coupon && { coupon: scrapeResult.coupon }),
            ...(scrapeResult.dealProgress && { dealProgress: scrapeResult.dealProgress }),
            ...(scrapeResult.otherSellers && { otherSellers: scrapeResult.otherSellers })
          }
        },
        { new: true }
      );

      // Check thresholds and notify users
      for (const tracker of updatedProduct.trackedBy) {
        const shouldNotify = await this.shouldNotifyUser(tracker, updatedProduct, previousPrice, currentPrice);

        if (shouldNotify) {
          await this.notifyUser(tracker, updatedProduct, previousPrice, currentPrice);

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

  async shouldNotifyUser(tracker, product, oldPrice, newPrice) {
    const priceChange = ((newPrice - oldPrice) / oldPrice) * 100;
    const isDecrease = newPrice < oldPrice;

    // Don't spam - wait at least 3 hours between alerts for the same product
    if (tracker.lastAlertedAt) {
      const hoursSinceLastAlert = (Date.now() - tracker.lastAlertedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAlert < 3) {
        return false;
      }
    }

    // ============================================
    // 1. ALWAYS NOTIFY: Threshold Met
    // ============================================
    if (tracker.thresholdPrice && oldPrice > tracker.thresholdPrice && newPrice <= tracker.thresholdPrice) {
      logger.info(`🎯 Alert: Threshold met for ${product.asin} (${newPrice} <= ${tracker.thresholdPrice})`);
      return true;
    }

    // Only proceed with smart alerts on price decreases
    if (!isDecrease) {
      return false;
    }

    // ============================================
    // 2. DEAL QUALITY ANALYSIS
    // ============================================
    if (!product.priceHistory || product.priceHistory.length < 5) {
      // Not enough history - use basic threshold (15% drop)
      if (Math.abs(priceChange) >= 15) {
        logger.info(`🔥 Alert: Significant drop ${priceChange.toFixed(1)}% for ${product.asin} (limited history)`);
        return true;
      }
      return false;
    }

    const stats30d = calculatePriceStats(product.priceHistory, 30);
    if (!stats30d) {
      // Fallback to basic logic
      return Math.abs(priceChange) >= 10;
    }

    // Calculate deal quality metrics
    const percentBelowAvg = ((stats30d.average - newPrice) / stats30d.average) * 100;
    const percentAboveLow = ((newPrice - stats30d.min) / stats30d.min) * 100;
    const isAtOrBelowLow = newPrice <= stats30d.min;
    const isNearLow = percentAboveLow <= 5; // Within 5% of 30-day low

    logger.info(`📊 Deal analysis for ${product.asin}:
      - New price: ${newPrice}
      - 30d Low: ${stats30d.min} | Avg: ${stats30d.average.toFixed(2)} | High: ${stats30d.max}
      - ${percentBelowAvg.toFixed(1)}% below average
      - ${percentAboveLow.toFixed(1)}% above 30-day low`);

    // ============================================
    // 3. EXCELLENT DEAL: At or below 30-day low
    // ============================================
    if (isAtOrBelowLow) {
      logger.info(`🌟 Excellent deal: Best price in 30 days for ${product.asin}`);
      return true;
    }

    // ============================================
    // 4. GREAT DEAL: Near low or significantly below average
    // ============================================
    if (isNearLow && Math.abs(priceChange) >= 10) {
      logger.info(`🔥 Great deal: Near 30-day low with ${priceChange.toFixed(1)}% drop for ${product.asin}`);
      return true;
    }

    if (percentBelowAvg >= 15 && Math.abs(priceChange) >= 10) {
      logger.info(`💎 Great deal: ${percentBelowAvg.toFixed(1)}% below 30d average for ${product.asin}`);
      return true;
    }

    // ============================================
    // 5. GOOD DEAL: Substantial drop from average
    // ============================================
    if (percentBelowAvg >= 20 && Math.abs(priceChange) >= 5) {
      logger.info(`✨ Good deal: ${percentBelowAvg.toFixed(1)}% below average for ${product.asin}`);
      return true;
    }

    // ============================================
    // 6. FILTER FAKE DEALS: Price still too high
    // ============================================
    if (newPrice > stats30d.min * 1.4) {
      logger.info(`⚠️ Skipping: Price ${newPrice} is still >40% above 30d low (${stats30d.min}) for ${product.asin}`);
      return false;
    }

    // ============================================
    // 7. NEAR THRESHOLD: Lower threshold when close
    // ============================================
    if (tracker.thresholdPrice && isDecrease) {
      const percentFromThreshold = ((newPrice - tracker.thresholdPrice) / tracker.thresholdPrice) * 100;
      if (percentFromThreshold <= 10 && Math.abs(priceChange) >= 5) {
        logger.info(`🎯 Alert: Close to threshold (${percentFromThreshold.toFixed(1)}% away) for ${product.asin}`);
        return true;
      }
    }

    logger.info(`😴 Skipping: Not a significant deal for ${product.asin}`);
    return false;
  }

  async notifyUser(tracker, product, oldPrice, newPrice) {
    try {
      const message = buildPriceAlertMessage(product, oldPrice, newPrice);

      if (product.imageUrl) {
        await this.bot.telegram.sendPhoto(tracker.chatId, product.imageUrl, {
          caption: message,
          parse_mode: 'MarkdownV2',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 Buy Now', url: product.url }]
            ]
          }
        });
      } else {
        await sendMessageWithRetry(this.bot, tracker.chatId, message, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false
        });
      }
      // Trigger Webhook if configured
      if (tracker.webhookUrl) {
        await sendWebhook(tracker.webhookUrl, 'price_alert', {
          product: {
            name: product.name,
            url: product.url,
            asin: product.asin,
            imageUrl: product.imageUrl
          },
          oldPrice,
          newPrice,
          threshold: tracker.thresholdPrice
        });
      }
    } catch (error) {
      logger.error(`Error notifying user ${tracker.chatId} about product ${product.asin}:`, error);
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

  async checkAllPrices(force = false) {
    const products = await Product.find({});
    logger.info(`Checking prices for ${products.length} products...`);

    // Smart Scheduling: Only check products that are due
    const now = new Date();
    const dueProducts = products.filter(p => {
      if (force) return true; // Force check all

      // Default to 30 mins if not set
      const intervalMinutes = p.checkInterval || 30;
      const lastChecked = p.lastChecked ? new Date(p.lastChecked) : new Date(0);
      const nextCheck = new Date(lastChecked.getTime() + intervalMinutes * 60000);

      return now >= nextCheck;
    });

    const skippedCount = products.length - dueProducts.length;
    logger.info(`Smart Scheduling: Checking ${dueProducts.length} products (${skippedCount} skipped as not due)`);

    // Use rate limiter to batch requests (3 concurrent max)
    const results = await Promise.allSettled(
      dueProducts.map(product => scrapingLimit(() => this.checkPrice(product)))
    );

    const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
    const failed = results.filter(r => r.status === 'rejected').length;
    const unchanged = results.filter(r => r.status === 'fulfilled' && !r.value).length;

    logger.info(`Price check completed:
      - ${succeeded} prices updated
      - ${unchanged} prices unchanged
      - ${failed} checks failed`);



    // Update ratings for a few products (async, don't block)
    this.updateSomeRatings().catch(err =>
      logger.error('Error updating ratings:', err)
    );

    // Save metrics
    try {
      await SystemMetric.create({
        type: 'scraper',
        data: {
          succeeded,
          unchanged,
          failed,
          total: products.length,
          duration: 0 // TODO: Measure duration
        }
      });
    } catch (e) {
      logger.error('Failed to save system metrics:', e);
    }

    return {
      succeeded,
      unchanged,
      failed
    };
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