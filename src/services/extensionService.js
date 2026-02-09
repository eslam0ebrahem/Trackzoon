import Product from '../models/Product.js';
import PricePoint from '../models/PricePoint.js';
import { logger } from '../utils/logger.js';
import { calculateDealScore, calculateVolatility, predictPriceTrend, calculatePriceStats } from '../utils/priceUtils.js';
import { aiService } from './aiService.js';

export class ExtensionService {
  static async getStatus(asin) {
    if (!asin) {
      const error = new Error('Missing ASIN');
      error.statusCode = 400;
      throw error;
    }

    const product = await Product.findOne({ asin }).select('asin currentPrice isOutOfStock lastUpdated');
    if (!product) {
      return { status: 'not_tracked', tracked: false, asin };
    }

    return {
      status: 'tracked',
      tracked: true,
      product: {
        asin: product.asin,
        currentPrice: product.currentPrice,
        isOutOfStock: product.isOutOfStock,
        lastUpdated: product.lastUpdated
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
    } = payload;

    if (!asin || !url || price === undefined) {
      const error = new Error('Missing required fields');
      error.statusCode = 400;
      throw error;
    }

    // AI VERIFICATION FALLBACK
    const skipAi = availabilityReason === 'unqualified-buybox' || availabilityReason === 'no-featured-offers';

    if ((isOutOfStock || price === 0) && !skipAi) {
      logger.info(`🕵️ Extension flagged ${asin} as OOS. Verifying with AI...`);
      const aiResult = await aiService.checkProductAvailability(url, null, { asin });

      if (aiResult && aiResult.isAvailable && aiResult.price) {
        logger.info(`✅ AI Correction: Item IS available at ${aiResult.price} EGP`);
        price = aiResult.price;
        isOutOfStock = false;
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
      const priceChanged = oldPrice !== price;

      product.currentPrice = price;
      product.isOutOfStock = isOutOfStock;
      product.lastChecked = new Date();
      product.lastUpdated = new Date();

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
          lastUpdated: new Date()
        };
      }

      if (priceChanged || product.priceHistory.length === 0) {
        product.priceHistory.push({ price, date: new Date() });

        await PricePoint.create({
          product: product._id,
          asin: product.asin,
          price: price,
          date: new Date()
        });

        if (priceChanged && oldPrice !== 0) {
          product.lastPriceChange = {
            date: new Date(),
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
      return { action: 'updated', product: { asin, price, smartScore: product.smartScore } };
    }

    if (!create) {
      logger.info(`🆕 New product detected ${asin}, waiting for user confirmation`);
      return {
        action: 'new_product',
        message: 'Product not tracked. User confirmation required.',
        product: { asin, name, price }
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
          lastUpdated: new Date()
        }
        : undefined,
      priceHistory: [{ price, date: new Date() }],
      lastChecked: new Date(),
      lastUpdated: new Date()
    });

    product.stats = { min: price, max: price, avg: price, volatility: 0 };
    product.smartScore = 50;

    await product.save();

    await PricePoint.create({
      product: product._id,
      asin: product.asin,
      price: price,
      date: new Date()
    });

    logger.info(`✨ Created new product ${asin} via extension`);
    return { action: 'created', product: { asin, price } };
  }
}
