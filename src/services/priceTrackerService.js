import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import SystemMetric from '../models/SystemMetric.js';
import PricePoint from '../models/PricePoint.js';
import pLimit from 'p-limit';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { logger } from '../utils/logger.js';
import { calculateVolatility, calculatePriceStats, calculateDealScore, predictPriceTrend, applyJitter, calculateDropProbability } from '../utils/priceUtils.js';
import { scraperService } from './scraperService.js';
import { NotificationService } from './notificationService.js';
import { priceCheckQueue } from '../queue/priceQueue.js';

export class PriceTrackerService {
  constructor(bot) {
    this.bot = bot;
    this.notificationService = new NotificationService(bot);
  }

  async checkPrice(product) {
    try {
      let currentPrice;
      let imageUrl = null;
      let scrapeResult = null;
      const wasOutOfStock = product.isOutOfStock || false;
      const previousPrice = product.currentPrice;
      const asin = product.asin;

      try {
        // Use ScraperService
        scrapeResult = await scraperService.scrapeProduct(product.url);

        currentPrice = scrapeResult.currentPrice;
        imageUrl = scrapeResult.imageUrl || null;

        // Product is now available
        if (wasOutOfStock) {
          logger.info(`Product ${product.asin} is now back in stock!`);

          const hasBeenInStockBefore = product.priceHistory &&
            product.priceHistory.length > 0 &&
            product.outOfStockSince != null;

          const shouldAddToHistory = !previousPrice ||
            previousPrice === 0 ||
            currentPrice !== previousPrice;

          const nextCheck = new Date(Date.now() + applyJitter(product.checkInterval || 60) * 60000);

          const updateOps = {
            $set: {
              isOutOfStock: false,
              outOfStockSince: null,
              currentPrice: currentPrice,
              lastChecked: new Date(),
              nextCheck, // Update next check time
              ...(imageUrl && { imageUrl }),
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

            // Add to PricePoint collection
            try {
              await PricePoint.create({
                product: product._id,
                asin: asin,
                price: currentPrice,
                date: new Date(),
                merchant: scrapeResult.merchant
              });
            } catch (err) {
              logger.error('Failed to create PricePoint:', err);
            }
          }

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

          if (hasBeenInStockBefore) {
            if (hasBeenInStockBefore) {
              const subscriptions = await Subscription.find({ product: updatedProduct._id }).populate('user');

              for (const sub of subscriptions) {
                if (!sub.user) continue; // User might be deleted

                if (!sub.targetPrice || currentPrice > sub.targetPrice) {
                  continue;
                }

                const shouldNotifyRestock = !sub.lastAlertedAt ||
                  (Date.now() - sub.lastAlertedAt.getTime()) > 7 * 24 * 60 * 60 * 1000;

                if (shouldNotifyRestock) {
                  // Use NotificationService
                  // Mock tracker object for compatibility or update NotificationService?
                  // NotificationService uses tracker.chatId and tracker.webhookUrl
                  const trackerMock = {
                    chatId: sub.user.telegramId,
                    thresholdPrice: sub.targetPrice,
                    alertType: sub.alertType,
                    percentageThreshold: sub.percentageThreshold,
                    baselinePrice: sub.baselinePrice,
                    webhookUrl: sub.user.settings?.webhookUrl
                  };

                  await this.notificationService.sendBackInStockAlert(trackerMock.chatId, updatedProduct, currentPrice, sub.targetPrice);

                  await Subscription.updateOne(
                    { _id: sub._id },
                    { $set: { lastAlertedAt: new Date() } }
                  );
                }
              }
            }
          }

          return {
            product: updatedProduct,
            previousPrice,
            currentPrice,
            wasOutOfStock: true
          };
        }

      } catch (priceError) {
        // Handle out-of-stock gracefully
        if (priceError.message.includes('out-of-stock') ||
          priceError.message.includes('third-party') ||
          priceError.message.includes('unavailable') ||
          priceError.message.includes('no-buybox') ||
          priceError.message.includes('no-buy-box')) {

          if (!wasOutOfStock) {
            await Product.findOneAndUpdate(
              { asin: asin },
              {
                $set: {
                  isOutOfStock: true,
                  outOfStockSince: new Date(),
                  lastChecked: new Date(),
                  nextCheck: new Date(Date.now() + applyJitter(60) * 60000) // Check again in ~1 hour
                },
                $push: {
                  stockHistory: {
                    status: 'out_of_stock',
                    date: new Date()
                  }
                }
              }
            );
          } else {
            await Product.findOneAndUpdate(
              { asin: asin },
              {
                $set: {
                  lastChecked: new Date(),
                  nextCheck: new Date(Date.now() + applyJitter(60) * 60000) // Check again in ~1 hour
                }
              }
            );
          }
          return null;
        }
        throw priceError;
      }

      // No price change
      if (currentPrice === previousPrice) {
        const { score: volatilityScore, interval: checkInterval } = calculateVolatility(product.priceHistory);
        const stats30d = calculatePriceStats(product.priceHistory, 30);
        const trend = predictPriceTrend(product.priceHistory);

        const smartScore = calculateDealScore(
          currentPrice,
          stats30d,
          volatilityScore,
          false,
          trend
        );

        let dealLabel = 'fair_price';
        if (smartScore >= 80) dealLabel = 'hot_deal';
        else if (smartScore >= 60) dealLabel = 'good_deal';
        else if (volatilityScore < 3) dealLabel = 'stable';

        const updatedProduct = await Product.findOneAndUpdate(
          { asin: asin },
          {
            $set: {
              lastChecked: new Date(),
              nextCheck: new Date(Date.now() + applyJitter(checkInterval) * 60000),
              volatilityScore,
              checkInterval,
              smartScore,
              dealLabel,
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
        await this.maybeSendDropProbabilityAlerts(updatedProduct);
        return false;
      }

      // Price Changed
      const newHistory = [...product.priceHistory, { price: currentPrice, date: new Date() }];
      const { score: volatilityScore, interval: checkInterval } = calculateVolatility(newHistory);
      const priceChangePercent = previousPrice > 0
        ? ((currentPrice - previousPrice) / previousPrice) * 100
        : 0;
      const isDrop = priceChangePercent < 0;
      const stats30d = calculatePriceStats(product.priceHistory, 30);
      const trend = predictPriceTrend(product.priceHistory);

      let smartScore = calculateDealScore(
        currentPrice,
        stats30d,
        volatilityScore,
        false,
        trend
      );

      // AI Analysis
      const daysSinceAnalysis = product.lastAiAnalysis
        ? (Date.now() - new Date(product.lastAiAnalysis).getTime()) / (1000 * 60 * 60 * 24)
        : 999;

      let aiAnalysisResult = null;

      if ((isDrop && Math.abs(priceChangePercent) > 3) || daysSinceAnalysis > 7) {
        try {
          const { aiService } = await import('./aiService.js');
          const firstPriceDate = product.priceHistory.length > 0
            ? new Date(product.priceHistory[0].date)
            : new Date();
          const daysTracked = (Date.now() - firstPriceDate.getTime()) / (1000 * 60 * 60 * 24);

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
            smartScore = aiResult.score;
          }
        } catch (err) {
          logger.error('Failed to run AI analysis:', err);
        }
      }

      // AI Prediction
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
            priceHistory: product.priceHistory
          });

          if (prediction) {
            aiPredictionResult = prediction;
          }
        } catch (err) {
          logger.warn('AI Prediction failed:', err.message);
        }
      }

      let dealLabel = 'fair_price';
      if (smartScore >= 80) dealLabel = 'hot_deal';
      else if (smartScore >= 60) dealLabel = 'good_deal';
      else if (priceChangePercent > 0) dealLabel = 'price_hike';
      else if (volatilityScore < 3) dealLabel = 'stable';

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
            nextCheck: new Date(Date.now() + applyJitter(checkInterval) * 60000),
            volatilityScore,
            checkInterval,
            smartScore,
            dealLabel,
            discountPercentage: priceChangePercent,
            ...(isDrop && { lastDropDate: new Date() }),
            lastPriceChange: {
              date: new Date(),
              oldPrice: previousPrice,
              newPrice: currentPrice,
              diff: currentPrice - previousPrice,
              percent: priceChangePercent
            },
            ...(aiAnalysisResult && {
              aiAnalysis: aiAnalysisResult.reason,
              lastAiAnalysis: new Date()
            }),
            ...(aiPredictionResult && {
              aiPrediction: {
                ...aiPredictionResult,
                lastUpdated: new Date()
              }
            }),
            ...(imageUrl && { imageUrl }),
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

      // Add to PricePoint collection
      try {
        await PricePoint.create({
          product: product._id,
          asin: asin,
          price: currentPrice,
          date: new Date(),
          merchant: scrapeResult.merchant
        });
      } catch (err) {
        logger.error('Failed to create PricePoint:', err);
      }

      // Notify Users
      // Notify Users
      const subscriptions = await Subscription.find({ product: updatedProduct._id }).populate('user');

      for (const sub of subscriptions) {
        if (!sub.user) continue;

        const trackerMock = {
          chatId: sub.user.telegramId,
          thresholdPrice: sub.targetPrice,
          alertType: sub.alertType,
          percentageThreshold: sub.percentageThreshold,
          baselinePrice: sub.baselinePrice,
          lastAlertedAt: sub.lastAlertedAt,
          snoozeUntil: sub.snoozeUntil,
          webhookUrl: sub.user.settings?.webhookUrl,
          user: sub.user // Optimization: Pass user object
        };

        const shouldNotify = await this.shouldNotifyUser(trackerMock, updatedProduct, previousPrice, currentPrice);

        if (shouldNotify) {
          // Use NotificationService
          await this.notificationService.sendPriceAlert(trackerMock, updatedProduct, previousPrice, currentPrice);

          const updatePayload = { lastAlertedAt: new Date() };
          if (trackerMock.alertType === 'percentage' && trackerMock.percentageThreshold) {
            updatePayload.baselinePrice = currentPrice;
            updatePayload.targetPrice = Number((currentPrice * (1 - trackerMock.percentageThreshold / 100)).toFixed(2));
          }

          const autoSnoozeHours = Number(process.env.ALERT_AUTO_SNOOZE_HOURS || 6);
          if (autoSnoozeHours > 0) {
            const snoozeUntil = new Date(Date.now() + autoSnoozeHours * 60 * 60 * 1000);
            if (!sub.snoozeUntil || new Date(sub.snoozeUntil) < snoozeUntil) {
              updatePayload.snoozeUntil = snoozeUntil;
            }
          }

          // Smart watch again: auto-adjust target after alert if enabled
          if (trackerMock.alertType === 'drop' && trackerMock.user?.settings?.watchAgain?.enabled) {
            try {
              const { buildSmartTargetSuggestions, pickSuggestionForSensitivity } = await import('../utils/smartTarget.js');
              const { suggestions } = buildSmartTargetSuggestions(updatedProduct);
              const picked = pickSuggestionForSensitivity(
                suggestions,
                trackerMock.user?.settings?.alertSensitivity || 'balanced'
              );
              if (picked?.targetPrice && picked.targetPrice < (trackerMock.thresholdPrice || Number.POSITIVE_INFINITY)) {
                updatePayload.targetPrice = picked.targetPrice;
              }
            } catch (err) {
              logger.warn(`Watch again auto-target failed for ${updatedProduct.asin}: ${err.message}`);
            }
          }

          await Subscription.updateOne(
            { _id: sub._id },
            { $set: updatePayload }
          );
        }
      }

      if (!isDrop) {
        await this.maybeSendDropProbabilityAlerts(updatedProduct);
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
    const priceChange = oldPrice > 0 ? ((newPrice - oldPrice) / oldPrice) * 100 : 0;
    const isDecrease = newPrice < oldPrice;
    let user = tracker.user;

    if (tracker.lastAlertedAt) {
      const hoursSinceLastAlert = (Date.now() - tracker.lastAlertedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastAlert < 3) return false;
    }

    // 1. Check User Settings (Quiet Mode, Min Discount)
    try {
      if (!user) user = await User.findOne({ telegramId: tracker.chatId });

      if (tracker.snoozeUntil && new Date() < new Date(tracker.snoozeUntil)) return false;

      if (user && user.settings) {
        if (user.settings.notifications === false) return false;

        // Quiet Mode
        if (user.settings.quietMode?.enabled) {
          const currentHour = new Date().getHours();
          const { startHour, endHour } = user.settings.quietMode;
          // Handle wrapping intervals (e.g. 23:00 to 07:00)
          const isQuietTime = startHour > endHour
            ? (currentHour >= startHour || currentHour < endHour)
            : (currentHour >= startHour && currentHour < endHour);

          if (isQuietTime) return false;
        }

        // Min Discount (Only applies if no specific threshold set)
        if (!tracker.thresholdPrice && isDecrease && user.settings.minDiscount > 0) {
          const dropPercent = Math.abs(priceChange);
          if (dropPercent < user.settings.minDiscount) return false; // Ignore tiny drops
        }
      }
    } catch (err) {
      logger.error(`Error checking user settings for ${tracker.chatId}:`, err);
    }

    // 2. Alert Type Checks (Priority)
    if (tracker.alertType === 'percentage' && tracker.percentageThreshold) {
      const baseline = tracker.baselinePrice || oldPrice;
      if (baseline > 0) {
        const targetPrice = baseline * (1 - tracker.percentageThreshold / 100);
        if (newPrice <= targetPrice && isDecrease) {
          return true;
        }
      }
      // Percentage alerts should not fall through to smart filtering
      return false;
    } else if (tracker.thresholdPrice && oldPrice > tracker.thresholdPrice && newPrice <= tracker.thresholdPrice) {
      // If user set a target, ALWAYS alert if met/crossed
      return true;
    }

    // 3. Smart Filtering
    if (!isDecrease) return false; // No alert for price increase/stable
    if (!user) user = await User.findOne({ telegramId: tracker.chatId });
    const sensitivity = user?.settings?.alertSensitivity || 'balanced';

    // Always alert for massive drops (>20%)
    if (Math.abs(priceChange) >= 20) return true;

    // Calculate context stats
    const stats30d = calculatePriceStats(product.priceHistory, 30);
    const trend = product.aiPrediction ? { trend: product.aiPrediction.trend } : predictPriceTrend(product.priceHistory);
    const dropProbability = stats30d ? calculateDropProbability(newPrice, stats30d, trend) : null;
    const smartScore = typeof product.smartScore === 'number' && product.smartScore > 0
      ? product.smartScore
      : (stats30d ? calculateDealScore(newPrice, stats30d, product.volatilityScore || 0, product.isOutOfStock, trend) : 0);

    // If no history, default to simple rule: Alert if drop > 10%
    if (!stats30d) return Math.abs(priceChange) >= 10;

    if (sensitivity === 'aggressive') {
      const minDrop = Math.max(user?.settings?.minDiscount || 0, 2);
      if (Math.abs(priceChange) >= minDrop) return true;
    }

    if (sensitivity === 'strict') {
      const strongSignal = smartScore >= 60 || (dropProbability !== null && dropProbability >= 60);
      const atLow = newPrice <= stats30d.min;
      if (!strongSignal && !atLow && Math.abs(priceChange) < 15) return false;
    }

    if (sensitivity === 'balanced') {
      if (dropProbability !== null && dropProbability < 25 && smartScore < 45 && Math.abs(priceChange) < 12) {
        return false;
      }
    }

    const isSpikeDrop = stats30d.max > 0 && oldPrice > stats30d.max * 1.05;
    if (isSpikeDrop && newPrice > stats30d.average) {
      // Price dropped from an abnormal spike but still above average.
      // Require a very large drop to avoid "fake deals".
      if (Math.abs(priceChange) < 25) return false;
    }

    if (stats30d.stdDev && stats30d.stdDev > 0) {
      const zScore = (stats30d.average - newPrice) / stats30d.stdDev;
      if (zScore < 0.35 && Math.abs(priceChange) < 12) return false;
    }

    // "Fake Deal" Detector:
    // If price is still above the 30-day average, only alert if it's a huge drop (>15%)
    // This prevents alerting when a price spiked to 200% yesterday and returned to 110% today.
    if (newPrice > stats30d.average) {
      return Math.abs(priceChange) >= 18;
    }

    // "All Time Low" Detector
    if (newPrice <= stats30d.min) return true;

    // "Near Low" Detector (within 5% of low)
    const percentAboveLow = ((newPrice - stats30d.min) / stats30d.min) * 100;
    if (percentAboveLow <= 5 && Math.abs(priceChange) >= 5) return true;

    // General "Good Deal": Below average by 10% AND dropped by at least 5% recently
    const percentBelowAvg = ((stats30d.average - newPrice) / stats30d.average) * 100;
    if (percentBelowAvg >= 10 && Math.abs(priceChange) >= 5) return true;

    return false;
  }

  async checkAllPrices(force = false) {
    const summary = {
      succeeded: 0,
      unchanged: 0,
      failed: 0,
      queued: 0,
      skipped: false
    };

    // Circuit Breaker Check via ScraperService state
    if (scraperService.coolDownUntil && Date.now() < scraperService.coolDownUntil) {
      const minutesLeft = Math.ceil((scraperService.coolDownUntil - Date.now()) / 60000);
      logger.warn(`❄️ Scraper is cooling down. Resuming in ${minutesLeft} minutes.`);
      return { ...summary, skipped: true };
    }

    const now = new Date();
    // OPTIMIZATION: Only fetch products needed
    const query = force ? {} : { nextCheck: { $lte: now } };

    // Fetch only needed fields initially to save memory if object is huge
    // But we need most fields for analysis, so standard find is okay if count is low.
    // For scalability, we might convert this to a cursor if > 1000 items.
    // For now, fetching "due" products is already a huge win (e.g. 50 instead of 1000).
    const dueProducts = await Product.find(query).limit(100); // Process in batches of 100 max per run to prevent OOM

    if (dueProducts.length === 0) {
      return summary;
    }

    logger.info(`Smart Scheduling: Checking ${dueProducts.length} due products (Force: ${force})`);

    // Use p-limit to control concurrency at the APPLICATION level
    // ScraperService also has a limit, but we want to control how many DB writes/price checks happen at once.
    // Let's match the ScraperService limit or slightly higher.

    // REFACTOR: Use BullMQ
    // We Map products to Jobs.

    // Clean queue before adding new batch? No, let them stack or handle dups.
    // Ideally we assume the queue handles it.

    try {
      // Try to add to Queue
      const jobPromises = dueProducts.map(product =>
        priceCheckQueue.add('check-price', { product: product.toObject() }, {
          jobId: `check-${product._id}-${now.getTime()}` // Prevent duplicates in same batch if any
        })
      );

      await Promise.all(jobPromises);

      logger.info(`Queued ${jobPromises.length} products for checking.`);
      return { ...summary, queued: jobPromises.length };

    } catch (queueError) {
      logger.warn(`⚠️ Queue usage failed (Redis down?), falling back to IN-MEMORY processing. Error: ${queueError.message}`);

      // FAILSAFE: In-memory concurrency fallback
      const limit = pLimit(1);
      const results = await Promise.allSettled(
        dueProducts.map(product => limit(() => this.checkPrice(product)))
      );

      const succeeded = results.filter(r => r.status === 'fulfilled' && r.value).length;
      const failed = results.filter(r => r.status === 'rejected').length;
      const unchanged = results.filter(r => r.status === 'fulfilled' && !r.value).length;

      logger.info(`(Fallback) Price check completed: ${succeeded} updated, ${unchanged} unchanged, ${failed} failed`);

      this.updateSomeRatings().catch(err => logger.error('Error updating ratings:', err));

      try {
        await SystemMetric.create({
          type: 'scraper',
          data: { succeeded, unchanged, failed, total: dueProducts.length, duration: 0 }
        });
      } catch (e) {
        logger.error('Failed to save system metrics:', e);
      }

      return { ...summary, succeeded, unchanged, failed };
    }
  }

  async updateSomeRatings() {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      // Find products that have at least one subscription
      const activeProductIds = await Subscription.distinct('product');

      const products = await Product.find({
        _id: { $in: activeProductIds },
        isOutOfStock: false,
        $or: [
          { 'rating.lastUpdated': { $exists: false } },
          { 'rating.lastUpdated': { $lt: sevenDaysAgo } }
        ]
      }).limit(5);

      for (const product of products) {
        // Import dynamically to avoid circular deps if needed, or just import at top if safe
        // ratingScraper is likely safe
        const { updateProductRating } = await import('./ratingScraper.js');
        await updateProductRating(product);
      }
    } catch (error) {
      logger.error('Error updating ratings:', error);
    }
  }

  async maybeSendDropProbabilityAlerts(product) {
    if (!product || product.isOutOfStock) return;
    if (!product.currentPrice || product.currentPrice <= 0) return;
    if (!product.priceHistory || product.priceHistory.length < 5) return;

    const stats30d = calculatePriceStats(product.priceHistory, 30);
    if (!stats30d) return;

    const trend = product.aiPrediction ? { trend: product.aiPrediction.trend } : predictPriceTrend(product.priceHistory);
    const probability = calculateDropProbability(product.currentPrice, stats30d, trend);

    const subscriptions = await Subscription.find({ product: product._id }).populate('user');
    if (!subscriptions || subscriptions.length === 0) return;

    for (const sub of subscriptions) {
      const user = sub.user;
      if (!user) continue;

      if (sub.snoozeUntil && new Date() < new Date(sub.snoozeUntil)) continue;
      if (user.settings?.notifications === false) continue;

      // Quiet mode check
      if (user.settings?.quietMode?.enabled) {
        const currentHour = new Date().getHours();
        const { startHour, endHour } = user.settings.quietMode;
        const isQuietTime = startHour > endHour
          ? (currentHour >= startHour || currentHour < endHour)
          : (currentHour >= startHour && currentHour < endHour);
        if (isQuietTime) continue;
      }

      const dropAlerts = user.settings?.dropProbabilityAlerts;
      if (!dropAlerts?.enabled) continue;

      const threshold = dropAlerts.threshold || 65;
      if (probability < threshold) continue;

      if (sub.lastProbabilityAlertAt) {
        const hoursSince = (Date.now() - new Date(sub.lastProbabilityAlertAt).getTime()) / (1000 * 60 * 60);
        if (hoursSince < 24) continue;
      }

      await this.notificationService.sendDropProbabilityAlert(
        { chatId: user.telegramId },
        product,
        probability,
        stats30d,
        trend
      );

      await Subscription.updateOne(
        { _id: sub._id },
        { $set: { lastProbabilityAlertAt: new Date() } }
      );
    }
  }
}
