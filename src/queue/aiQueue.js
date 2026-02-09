import { Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import { aiService } from '../services/aiService.js';
import Product from '../models/Product.js';
import Subscription from '../models/Subscription.js';
import PricePoint from '../models/PricePoint.js';
import { calculateVolatility, calculatePriceStats, calculateDealScore, applyJitter } from '../utils/priceUtils.js';
import { getReliableTrend } from '../utils/trendUtils.js';
import { NotificationService } from '../services/notificationService.js';
import { PriceTrackerService } from '../services/priceTrackerService.js';

const connection = {
  url: process.env.REDIS_URL || 'redis://localhost:6379'
};

const buildDealLabel = (smartScore, volatilityScore, priceChangePercent) => {
  if (smartScore >= 80) return 'hot_deal';
  if (smartScore >= 60) return 'good_deal';
  if (priceChangePercent > 0) return 'price_hike';
  if (volatilityScore < 3) return 'stable';
  return 'fair_price';
};

export const createAiWorker = (bot) => {
  const notificationService = new NotificationService(bot);
  const priceTracker = new PriceTrackerService(bot);

  const worker = new Worker('ai-availability-queue', async (job) => {
    const { asin, url } = job.data;

    const product = await Product.findOne({ asin });
    if (!product) {
      logger.warn(`AI availability: product ${asin} not found`);
      return null;
    }

    const aiResult = await aiService.checkProductAvailability(url, null, { asin });
    if (!aiResult) return null;

    if (!aiResult.isAvailable || !aiResult.price) {
      if (!product.isOutOfStock) {
        await Product.updateOne(
          { _id: product._id },
          {
            $set: {
              isOutOfStock: true,
              outOfStockSince: product.outOfStockSince || new Date(),
              lastChecked: new Date(),
              nextCheck: new Date(Date.now() + applyJitter(60) * 60000)
            },
            $push: {
              stockHistory: { status: 'out_of_stock', date: new Date() }
            }
          }
        );
      }
      return null;
    }

    const previousPrice = product.currentPrice;
    const currentPrice = aiResult.price;
    const wasOutOfStock = product.isOutOfStock;
    const now = new Date();
    const priceChanged = previousPrice !== currentPrice;
    const priceHistory = Array.isArray(product.priceHistory) ? product.priceHistory : [];
    const newHistory = priceChanged ? [...priceHistory, { price: currentPrice, date: now }] : priceHistory;

    const stats30d = calculatePriceStats(priceHistory, 30);
    const trend = getReliableTrend(product, priceHistory);
    const { score: volatilityScore, interval: checkInterval } = calculateVolatility(newHistory);
    const priceChangePercent = previousPrice > 0
      ? ((currentPrice - previousPrice) / previousPrice) * 100
      : 0;
    const smartScore = calculateDealScore(currentPrice, stats30d, volatilityScore, false, trend);
    const dealLabel = buildDealLabel(smartScore, volatilityScore, priceChangePercent);

    const updateOps = {
      $set: {
        currentPrice,
        isOutOfStock: false,
        outOfStockSince: null,
        lastChecked: now,
        nextCheck: new Date(Date.now() + applyJitter(checkInterval || 60) * 60000),
        volatilityScore,
        checkInterval,
        smartScore,
        dealLabel,
        anomaly: {
          isAnomaly: false,
          score: 0,
          reason: null,
          detectedAt: null
        }
      }
    };

    if (priceChanged) {
      updateOps.$set.discountPercentage = priceChangePercent;
      if (priceChangePercent < 0) {
        updateOps.$set.lastDropDate = now;
      }
      updateOps.$set.lastPriceChange = {
        date: now,
        oldPrice: previousPrice,
        newPrice: currentPrice,
        diff: currentPrice - previousPrice,
        percent: priceChangePercent
      };
      updateOps.$push = {
        priceHistory: { price: currentPrice, date: now }
      };
    }

    if (wasOutOfStock) {
      if (!updateOps.$push) updateOps.$push = {};
      updateOps.$push.stockHistory = { status: 'in_stock', date: now };
    }

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: product._id },
      updateOps,
      { new: true }
    );

    if (priceChanged) {
      try {
        await PricePoint.create({
          product: product._id,
          asin,
          price: currentPrice,
          date: now
        });
      } catch (err) {
        logger.error('AI availability: failed to create PricePoint:', err);
      }
    }

    const subscriptions = await Subscription.find({ product: updatedProduct._id }).populate('user');
    if (!subscriptions || subscriptions.length === 0) return updatedProduct;

    if (wasOutOfStock) {
      for (const sub of subscriptions) {
        if (!sub.user) continue;
        if (!sub.targetPrice || currentPrice > sub.targetPrice) continue;

        const shouldNotifyRestock = !sub.lastAlertedAt ||
          (Date.now() - sub.lastAlertedAt.getTime()) > 7 * 24 * 60 * 60 * 1000;
        if (!shouldNotifyRestock) continue;

        await notificationService.sendBackInStockAlert(
          sub.user.telegramId,
          updatedProduct,
          currentPrice,
          sub.targetPrice
        );

        await Subscription.updateOne(
          { _id: sub._id },
          { $set: { lastAlertedAt: new Date() } }
        );
      }
      return updatedProduct;
    }

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
        user: sub.user
      };

      const shouldNotify = await priceTracker.shouldNotifyUser(
        trackerMock,
        updatedProduct,
        previousPrice,
        currentPrice
      );

      if (shouldNotify) {
        await notificationService.sendPriceAlert(trackerMock, updatedProduct, previousPrice, currentPrice);

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

        await Subscription.updateOne(
          { _id: sub._id },
          { $set: updatePayload }
        );
      }
    }

    return updatedProduct;
  }, {
    connection,
    concurrency: 1,
    limiter: {
      max: 1,
      duration: 10000
    }
  });

  worker.on('completed', () => {});
  worker.on('failed', (job, err) => {
    logger.error(`AI availability job ${job?.id} failed: ${err.message}`);
  });

  return worker;
};
