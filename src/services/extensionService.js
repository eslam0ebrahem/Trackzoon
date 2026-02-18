import Product from '../models/Product.js';
import PricePoint from '../models/PricePoint.js';
import SystemMetric from '../models/SystemMetric.js';
import { logger } from '../utils/logger.js';
import { calculateDealScore, calculateVolatility, predictPriceTrend, calculatePriceStats } from '../utils/priceUtils.js';
import { aiService } from './aiService.js';

const SKIP_AI_REASONS = new Set(['unqualified-buybox', 'no-featured-offers']);

const asTrimmedString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  return String(value).trim();
};

const asBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true;
    if (normalized === 'false' || normalized === '0' || normalized === 'no') return false;
  }
  return fallback;
};

const asNumber = (value, { min = null, max = null, integer = false } = {}) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  let normalized = parsed;
  if (min !== null && normalized < min) normalized = min;
  if (max !== null && normalized > max) normalized = max;
  if (integer) normalized = Math.round(normalized);
  return normalized;
};

const normalizeSyncPayload = (payload = {}) => {
  const asin = asTrimmedString(payload.asin).toUpperCase();
  const url = asTrimmedString(payload.url);
  const name = asTrimmedString(payload.name);
  const imageUrl = asTrimmedString(payload.imageUrl);
  const merchant = asTrimmedString(payload.merchant);
  const deliveryMessage = asTrimmedString(payload.deliveryMessage);
  const coupon = asTrimmedString(payload.coupon);
  const availabilityReason = asTrimmedString(payload.availabilityReason).toLowerCase();

  const price = asNumber(payload.price, { min: 0 });
  const rating = asNumber(payload.rating, { min: 0, max: 5 });
  const ratingCount = asNumber(payload.ratingCount, { min: 0, integer: true });
  const create = asBoolean(payload.create, false);
  const prime = payload.prime === undefined || payload.prime === null
    ? null
    : asBoolean(payload.prime, false);
  const isOutOfStock = asBoolean(
    payload.isOutOfStock,
    price === 0 || SKIP_AI_REASONS.has(availabilityReason)
  );

  return {
    asin,
    url,
    name,
    price,
    imageUrl,
    isOutOfStock,
    create,
    availabilityReason,
    rating,
    ratingCount,
    merchant,
    prime,
    deliveryMessage,
    coupon
  };
};

export class ExtensionService {
  static async getStatus(asin) {
    const normalizedAsin = asTrimmedString(asin).toUpperCase();
    if (!normalizedAsin) {
      const error = new Error('Missing ASIN');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findOne({ asin: normalizedAsin })
      .select('asin currentPrice isOutOfStock lastUpdated lastChecked smartScore merchant prime rating coupon outOfStockSince');
    if (!product) {
      return { status: 'not_tracked', tracked: false, asin: normalizedAsin };
    }

    const now = Date.now();
    const lastCheckedMs = product.lastChecked ? new Date(product.lastChecked).getTime() : null;
    const ageMinutes = lastCheckedMs ? Math.round((now - lastCheckedMs) / 60000) : null;

    return {
      status: 'tracked',
      tracked: true,
      freshness: {
        ageMinutes,
        stale: typeof ageMinutes === 'number' ? ageMinutes > 120 : false
      },
      product: {
        asin: product.asin,
        currentPrice: product.currentPrice,
        isOutOfStock: product.isOutOfStock,
        smartScore: product.smartScore || 0,
        merchant: product.merchant || null,
        prime: !!product.prime,
        coupon: product.coupon || null,
        rating: {
          stars: product.rating?.stars ?? null,
          count: product.rating?.count ?? 0
        },
        outOfStockSince: product.outOfStockSince || null,
        lastChecked: product.lastChecked || null,
        lastUpdated: product.lastUpdated || null
      }
    };
  }

  static async syncProduct(payload) {
    let {
      asin,
      url,
      name,
      price,
      imageUrl,
      isOutOfStock,
      create,
      availabilityReason,
      rating,
      ratingCount,
      merchant,
      prime,
      deliveryMessage,
      coupon
    } = normalizeSyncPayload(payload);

    if (!asin || !url || price === null) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      throw error;
    }

    const now = new Date();
    let aiVerified = false;
    let aiCorrected = false;

    // AI VERIFICATION FALLBACK
    const skipAi = SKIP_AI_REASONS.has(availabilityReason);

    if ((isOutOfStock || price === 0) && !skipAi) {
      logger.info(`🕵️ Extension flagged ${asin} as OOS. Verifying with AI...`);
      aiVerified = true;
      const aiResult = await aiService.checkProductAvailability(url, null, { asin });
      const aiPrice = asNumber(aiResult?.price, { min: 0 });

      if (aiResult && aiResult.isAvailable && aiPrice && aiPrice > 0) {
        logger.info(`✅ AI Correction: Item IS available at ${aiPrice} EGP`);
        price = aiPrice;
        isOutOfStock = false;
        aiCorrected = true;
      } else if (aiResult && !aiResult.isAvailable) {
        logger.debug(`✅ AI Confirmed OOS: ${aiResult.reason}`);
      }
    } else if (skipAi) {
      logger.info(`⚠️ Extension flagged ${asin} as unavailable (${availabilityReason}). Skipping AI verification.`);
    }

    logger.info(`📥 Extension Sync: ${asin} - ${price} EGP (OOS: ${isOutOfStock})`);

    let product = await Product.findOne({ asin });

    if (product) {
      const oldPrice = product.currentPrice;
      const wasOutOfStock = Boolean(product.isOutOfStock);
      const priceChanged = oldPrice !== price;

      product.currentPrice = price;
      product.isOutOfStock = isOutOfStock;
      product.lastChecked = now;
      product.lastUpdated = now;

      if (!product.imageUrl && imageUrl) product.imageUrl = imageUrl;
      if (!product.name && name) product.name = name;
      if (merchant) product.merchant = merchant;
      if (typeof prime === 'boolean') product.prime = prime;
      if (coupon) product.coupon = coupon;
      if (deliveryMessage) {
        product.delivery = {
          ...product.delivery,
          message: deliveryMessage
        };
      }
      const hasRating = typeof rating === 'number' && !Number.isNaN(rating);
      const hasRatingCount = typeof ratingCount === 'number' && !Number.isNaN(ratingCount);
      if (hasRating || hasRatingCount) {
        product.rating = {
          stars: hasRating ? rating : product.rating?.stars,
          count: hasRatingCount ? ratingCount : (product.rating?.count || 0),
          lastUpdated: now
        };
      }

      if (wasOutOfStock !== isOutOfStock) {
        product.stockHistory.push({
          status: isOutOfStock ? 'out_of_stock' : 'in_stock',
          date: now
        });
      }
      if (isOutOfStock && !wasOutOfStock) {
        product.outOfStockSince = now;
      } else if (!isOutOfStock) {
        product.outOfStockSince = null;
      }

      if (priceChanged || product.priceHistory.length === 0) {
        product.priceHistory.push({ price, date: now });

        await PricePoint.create({
          product: product._id,
          asin: product.asin,
          price: price,
          date: now
        });

        if (priceChanged && oldPrice !== 0) {
          product.lastPriceChange = {
            date: now,
            oldPrice,
            newPrice: price,
            diff: price - oldPrice,
            percent: ((price - oldPrice) / oldPrice) * 100
          };
        }
      }

      const stats = calculatePriceStats(product.priceHistory);
      if (stats) {
        const vol = calculateVolatility(product.priceHistory);
        const trend = predictPriceTrend(product.priceHistory);
        product.stats = {
          min: stats.min,
          max: stats.max,
          avg: stats.average,
          volatility: vol.score
        };
        product.volatilityScore = vol.score;
        product.smartScore = calculateDealScore(price, stats, vol.score, isOutOfStock, trend);
      }

      await product.save();
      logger.info(`✅ Updated product ${asin} via extension`);
      return {
        action: 'updated',
        product: { asin, price, smartScore: product.smartScore },
        meta: {
          aiVerified,
          aiCorrected,
          availabilityReason: availabilityReason || null,
          syncAt: now.toISOString()
        }
      };
    }

    if (!create) {
      logger.info(`🆕 New product detected ${asin}, waiting for user confirmation`);
      return {
        action: 'new_product',
        message: 'Product not tracked. User confirmation required.',
        product: { asin, name, price },
        meta: {
          aiVerified,
          aiCorrected,
          availabilityReason: availabilityReason || null,
          syncAt: now.toISOString()
        }
      };
    }

    product = new Product({
      asin,
      url,
      name,
      imageUrl,
      currentPrice: price,
      isOutOfStock,
      merchant: merchant || undefined,
      prime: typeof prime === 'boolean' ? prime : undefined,
      coupon: coupon || undefined,
      delivery: deliveryMessage ? { message: deliveryMessage } : undefined,
      rating: (typeof rating === 'number' && !Number.isNaN(rating)) || (typeof ratingCount === 'number' && !Number.isNaN(ratingCount))
        ? {
          stars: typeof rating === 'number' && !Number.isNaN(rating) ? rating : undefined,
          count: typeof ratingCount === 'number' && !Number.isNaN(ratingCount) ? ratingCount : 0,
          lastUpdated: now
        }
        : undefined,
      priceHistory: [{ price, date: now }],
      stockHistory: [{ status: isOutOfStock ? 'out_of_stock' : 'in_stock', date: now }],
      outOfStockSince: isOutOfStock ? now : null,
      lastChecked: now,
      lastUpdated: now
    });

    product.stats = { min: price, max: price, avg: price, volatility: 0 };
    product.smartScore = 50;

    await product.save();

    await PricePoint.create({
      product: product._id,
      asin: product.asin,
      price: price,
      date: now
    });

    logger.info(`✨ Created new product ${asin} via extension`);
    return {
      action: 'created',
      product: { asin, price },
      meta: {
        aiVerified,
        aiCorrected,
        availabilityReason: availabilityReason || null,
        syncAt: now.toISOString()
      }
    };
  }

  static async syncProductsBatch(items = [], options = {}) {
    if (!Array.isArray(items) || items.length === 0) {
      const error = new Error('Expected non-empty items array');
      error.statusCode = 400;
      throw error;
    }

    const continueOnError = options.continueOnError !== false;
    const limit = Math.max(1, Math.min(500, Number(options.limit) || items.length));
    const selectedItems = items.slice(0, limit);

    const summary = {
      requested: items.length,
      processed: 0,
      succeeded: 0,
      failed: 0,
      created: 0,
      updated: 0,
      newProduct: 0,
      aiCorrected: 0
    };
    const results = [];

    for (let index = 0; index < selectedItems.length; index++) {
      const input = selectedItems[index];
      const startedAt = Date.now();

      try {
        const result = await this.syncProduct(input);
        summary.processed += 1;
        summary.succeeded += 1;
        if (result.action === 'created') summary.created += 1;
        if (result.action === 'updated') summary.updated += 1;
        if (result.action === 'new_product') summary.newProduct += 1;
        if (result.meta?.aiCorrected) summary.aiCorrected += 1;

        await this.recordSyncMetric({
          source: 'batch',
          status: 'success',
          action: result.action,
          asin: result.product?.asin || asTrimmedString(input?.asin).toUpperCase() || null,
          durationMs: Date.now() - startedAt,
          aiVerified: !!result.meta?.aiVerified,
          aiCorrected: !!result.meta?.aiCorrected,
          availabilityReason: result.meta?.availabilityReason || null
        });

        results.push({ index, status: 'success', ...result });
      } catch (error) {
        summary.processed += 1;
        summary.failed += 1;

        await this.recordSyncMetric({
          source: 'batch',
          status: 'error',
          action: 'error',
          asin: asTrimmedString(input?.asin).toUpperCase() || null,
          durationMs: Date.now() - startedAt,
          error: error.message
        });

        results.push({
          index,
          status: 'error',
          asin: asTrimmedString(input?.asin).toUpperCase() || null,
          error: error.message,
          code: error.statusCode || 500
        });

        if (!continueOnError) break;
      }
    }

    return { summary, results };
  }

  static async recordSyncMetric({
    source = 'single',
    status = 'success',
    action = 'updated',
    asin = null,
    durationMs = null,
    aiVerified = false,
    aiCorrected = false,
    availabilityReason = null,
    error = null
  } = {}) {
    try {
      await SystemMetric.create({
        type: 'extension',
        data: {
          source,
          status,
          action,
          asin,
          durationMs,
          aiVerified,
          aiCorrected,
          availabilityReason,
          error
        }
      });
    } catch (metricError) {
      logger.warn(`Extension metric write failed: ${metricError.message}`);
    }
  }

  static async getSyncHealth(hours = 24) {
    const safeHours = Math.max(1, Math.min(168, Number(hours) || 24));
    const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);
    const events = await SystemMetric.find({
      type: 'extension',
      timestamp: { $gte: since }
    })
      .sort({ timestamp: -1 })
      .limit(1000)
      .lean();

    const summary = {
      windowHours: safeHours,
      totalEvents: events.length,
      successes: 0,
      failures: 0,
      created: 0,
      updated: 0,
      newProduct: 0,
      aiCorrected: 0,
      topAvailabilityReasons: {},
      lastSyncAt: events[0]?.timestamp || null
    };

    for (const event of events) {
      const data = event?.data || {};
      if (data.status === 'error') {
        summary.failures += 1;
      } else {
        summary.successes += 1;
      }

      if (data.action === 'created') summary.created += 1;
      if (data.action === 'updated') summary.updated += 1;
      if (data.action === 'new_product') summary.newProduct += 1;
      if (data.aiCorrected) summary.aiCorrected += 1;

      if (data.availabilityReason) {
        summary.topAvailabilityReasons[data.availabilityReason] = (summary.topAvailabilityReasons[data.availabilityReason] || 0) + 1;
      }
    }

    return summary;
  }
}
