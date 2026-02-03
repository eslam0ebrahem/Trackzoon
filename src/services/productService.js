import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import mongoose from 'mongoose';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { resolveAmazonUrl } from '../utils/url.js';
import { logger } from '../utils/logger.js';
import { calculatePriceStats } from '../utils/priceUtils.js';

export class ProductService {
  static async previewProduct(productUrl) {
    try {
      const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

      if (!asin) {
        throw new BotError('Invalid Amazon URL', ErrorCodes.INVALID_URL);
      }

      // Check if product exists in DB first to save scraping
      const existingProduct = await Product.findOne({ asin });
      if (existingProduct) {
        return {
          asin,
          name: existingProduct.name,
          currentPrice: existingProduct.currentPrice,
          imageUrl: existingProduct.imageUrl,
          isOutOfStock: existingProduct.isOutOfStock,
          exists: true
        };
      }

      // If not in DB, scrape it
      const name = await getProductName(resolvedUrl);
      const { currentPrice, imageUrl } = await getPrice(resolvedUrl);

      return {
        asin,
        name,
        currentPrice,
        imageUrl,
        isOutOfStock: false,
        exists: false
      };

    } catch (error) {
      if (error instanceof BotError) throw error;
      logger.error('Error previewing product:', error);
      throw new BotError(
        'Failed to preview product',
        ErrorCodes.SCRAPING_ERROR,
        `Could not fetch product details: ${error.message}`
      );
    }
  }

  static async addProduct(productUrl, chatId, threshold = 0, options = {}) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const alertType = options.alertType || 'drop';
      const isPercentageAlert = alertType === 'percentage';
      const percentageThreshold = options.percentageThreshold ?? (isPercentageAlert ? threshold : null);
      const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

      if (!asin) {
        throw new BotError('Invalid Amazon URL', ErrorCodes.INVALID_URL);
      }

      // Get User
      const user = await User.findOne({ telegramId: chatId }).session(session);
      if (!user) {
        // Should ideally be handled by middleware, but safe check
        throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND, 'User not registered.');
      }

      let isNew = false;
      let isAlreadyTracked = false;

      // Check if product exists
      let product = await Product.findOne({ asin }).session(session);

      if (product) {
        // Check if subscription exists
        const existingSubscription = await Subscription.findOne({ user: user._id, product: product._id }).session(session);
        if (existingSubscription) {
          isAlreadyTracked = true;
          await session.abortTransaction();
          // Attach the existing threshold to the product object for the controller to use
          // The controller expects product.trackedBy to find the threshold.
          // We need to mock this structure or update the controller.
          // For now, let's attach a temporary property or mock trackedBy for backward compatibility if needed.
          // But better to return the subscription info separately or attach it.
          product.currentUserSubscription = existingSubscription;
          product.trackedBy = [{
            chatId: chatId,
            thresholdPrice: existingSubscription.targetPrice,
            snoozeUntil: existingSubscription.snoozeUntil,
            alertType: existingSubscription.alertType,
            percentageThreshold: existingSubscription.percentageThreshold,
            baselinePrice: existingSubscription.baselinePrice
          }];
          return { product, isNew, isAlreadyTracked };
        }
      }

      // Product doesn't exist
      if (!product) {
        isNew = true;
        const name = await getProductName(resolvedUrl);
        let currentPrice;
        let isOutOfStock = false;
        let imageUrl = null;

        try {
          const scrapeResult = await getPrice(resolvedUrl);
          currentPrice = scrapeResult.currentPrice;
          imageUrl = scrapeResult.imageUrl;
        } catch (priceError) {
          if (priceError.message.includes('out of stock') ||
            priceError.message.includes('unavailable') ||
            priceError.message.includes('no-buybox') ||
            priceError.message.includes('Captcha')) {
            logger.info(`Product ${asin} scraping issue (${priceError.message}), tracking with threshold as placeholder`);
            if (isPercentageAlert) {
              currentPrice = 0;
              isOutOfStock = true;
            } else {
              currentPrice = threshold;
              isOutOfStock = true;
            }
          } else {
            throw priceError;
          }
        }

        // AI Categorization
        let category = 'Uncategorized';
        let tags = [];
        try {
          const { aiService } = await import('./aiService.js');
          const aiCat = await aiService.categorizeProduct(name);
          category = aiCat.category || 'Uncategorized';
          tags = aiCat.tags || [];
        } catch (err) {
          logger.warn('AI Categorization skipped:', err.message);
        }

        product = new Product({
          asin,
          name,
          url: resolvedUrl,
          imageUrl,
          currentPrice,
          isOutOfStock,
          category,
          tags,
          priceHistory: [{ price: currentPrice, date: new Date() }],
          // trackedBy is removed
        });

        await product.save({ session });
      }

      // Create Subscription
      let targetPrice = threshold;
      let baselinePrice = null;

      if (isPercentageAlert) {
        if (typeof percentageThreshold === 'number' && percentageThreshold > 0) {
          baselinePrice = options.baselinePrice ?? (product.currentPrice > 0 ? product.currentPrice : null);
          if (baselinePrice) {
            targetPrice = Number((baselinePrice * (1 - percentageThreshold / 100)).toFixed(2));
          } else {
            targetPrice = null;
          }
        }
      }

      const subscription = new Subscription({
        user: user._id,
        product: product._id,
        targetPrice,
        alertType: isPercentageAlert ? 'percentage' : 'drop',
        ...(isPercentageAlert && { percentageThreshold, baselinePrice })
      });

      await subscription.save({ session });

      // Update user last active
      await User.findOneAndUpdate(
        { _id: user._id },
        { $set: { lastActive: new Date() } },
        { session }
      );

      await session.commitTransaction();

      // Attach subscription for caller convenience
      product.currentUserSubscription = subscription;

      return { product, isNew, isAlreadyTracked };

    } catch (error) {
      await session.abortTransaction();

      if (error instanceof BotError) throw error;

      logger.error('Error adding product:', error);
      throw new BotError(
        'Failed to add product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to add the product. Please try again later.'
      );
    } finally {
      session.endSession();
    }
  }

  static async removeProduct(asin, chatId) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const user = await User.findOne({ telegramId: chatId }).session(session);
      if (!user) {
        throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND);
      }

      const product = await Product.findOne({ asin }).session(session);
      if (!product) {
        throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);
      }

      const subscription = await Subscription.findOneAndDelete({ user: user._id, product: product._id }).session(session);

      if (!subscription) {
        await session.abortTransaction();
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      // Check if any other subscriptions exist for this product
      const otherSubscriptionsCount = await Subscription.countDocuments({ product: product._id }).session(session);

      if (otherSubscriptionsCount === 0) {
        // Delete product if no one else is tracking it
        await Product.deleteOne({ _id: product._id }).session(session);
      }

      // Remove from user's product list (Legacy cleanup)
      // We can keep this for now or remove it if we are sure
      // But since we are refactoring, let's stop writing to it?
      // Actually, if we stop writing to it, we might break legacy code reading it.
      // But we are supposed to refactor readers too.
      // Let's keep it for safety but wrap in try-catch or just do it.
      await User.findOneAndUpdate(
        { _id: user._id },
        { $pull: { products: product._id } },
        { session }
      );

      await session.commitTransaction();
      return product;

    } catch (error) {
      await session.abortTransaction();

      if (error instanceof BotError) throw error;

      logger.error('Error removing product:', error);
      throw new BotError(
        'Failed to remove product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to remove the product. Please try again later.'
      );
    } finally {
      session.endSession();
    }
  }

  static async updateThreshold(asin, chatId, newThreshold) {
    try {
      const user = await User.findOne({ telegramId: chatId });
      if (!user) throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND);

      const product = await Product.findOne({ asin });
      if (!product) throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);

      const subscription = await Subscription.findOneAndUpdate(
        { user: user._id, product: product._id },
        {
          $set: {
            targetPrice: newThreshold,
            alertType: 'drop',
            percentageThreshold: null,
            baselinePrice: null
          }
        },
        { new: true }
      );

      if (!subscription) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      // Attach subscription for caller
      product.currentUserSubscription = subscription;
      return product;

    } catch (error) {
      if (error instanceof BotError) throw error;

      logger.error('Error updating threshold:', error);
      throw new BotError(
        'Failed to update threshold',
        ErrorCodes.DATABASE_ERROR,
        'Failed to update the threshold. Please try again later.'
      );
    }
  }

  static async updatePercentageThreshold(asin, chatId, percentageThreshold) {
    try {
      if (typeof percentageThreshold !== 'number' || Number.isNaN(percentageThreshold) || percentageThreshold <= 0 || percentageThreshold >= 100) {
        throw new BotError('Invalid percentage threshold', ErrorCodes.INVALID_THRESHOLD, 'Percentage must be between 1 and 99.');
      }

      const user = await User.findOne({ telegramId: chatId });
      if (!user) throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND);

      const product = await Product.findOne({ asin });
      if (!product) throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);

      const baselinePrice = product.currentPrice > 0 ? product.currentPrice : null;
      const targetPrice = baselinePrice
        ? Number((baselinePrice * (1 - percentageThreshold / 100)).toFixed(2))
        : null;

      const subscription = await Subscription.findOneAndUpdate(
        { user: user._id, product: product._id },
        {
          $set: {
            alertType: 'percentage',
            percentageThreshold,
            baselinePrice,
            targetPrice
          }
        },
        { new: true }
      );

      if (!subscription) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      product.currentUserSubscription = subscription;
      // Backward compatibility mock
      product.trackedBy = [{
        chatId: chatId,
        thresholdPrice: subscription.targetPrice,
        snoozeUntil: subscription.snoozeUntil,
        alertType: subscription.alertType,
        percentageThreshold: subscription.percentageThreshold,
        baselinePrice: subscription.baselinePrice
      }];

      return product;
    } catch (error) {
      if (error instanceof BotError) throw error;

      logger.error('Error updating percentage threshold:', error);
      throw new BotError(
        'Failed to update percentage threshold',
        ErrorCodes.DATABASE_ERROR,
        'Failed to update the percentage threshold. Please try again later.'
      );
    }
  }

  static async snoozeProduct(asin, chatId, hours) {
    try {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

      const user = await User.findOne({ telegramId: chatId });
      if (!user) throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND);

      const product = await Product.findOne({ asin });
      if (!product) throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);

      const subscription = await Subscription.findOneAndUpdate(
        { user: user._id, product: product._id },
        { $set: { snoozeUntil: snoozeUntil } },
        { new: true }
      );

      if (!subscription) {
        throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);
      }

      // Attach subscription for caller
      product.currentUserSubscription = subscription;
      return product;
    } catch (error) {
      if (error instanceof BotError) throw error;
      logger.error('Error snoozing product:', error);
      throw new BotError('Failed to snooze product', ErrorCodes.DATABASE_ERROR);
    }
  }

  static async getUserProducts(chatId) {
    try {
      const user = await User.findOne({ telegramId: chatId });
      if (!user) return [];

      const subscriptions = await Subscription.find({ user: user._id }).populate('product');

      return subscriptions.map(sub => {
        const product = sub.product;
        if (product) {
          product.currentUserSubscription = sub;
          // Backward compatibility mock for listCommand
          product.trackedBy = [{
            chatId: chatId,
            thresholdPrice: sub.targetPrice,
            snoozeUntil: sub.snoozeUntil,
            alertType: sub.alertType,
            percentageThreshold: sub.percentageThreshold,
            baselinePrice: sub.baselinePrice
          }];
        }
        return product;
      }).filter(p => p != null);

    } catch (error) {
      logger.error('Error fetching user products:', error);
      throw new BotError(
        'Failed to fetch products',
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch your products. Please try again later.'
      );
    }
  }

  static async getProduct(asin, chatId) {
    try {
      const user = await User.findOne({ telegramId: chatId });
      if (!user) throw new BotError('User not found', ErrorCodes.USER_NOT_FOUND);

      const product = await Product.findOne({ asin });
      if (!product) {
        throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);
      }

      const subscription = await Subscription.findOne({ user: user._id, product: product._id });

      if (!subscription) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      product.currentUserSubscription = subscription;
      // Backward compatibility mock
      product.trackedBy = [{
        chatId: chatId,
        thresholdPrice: subscription.targetPrice,
        snoozeUntil: subscription.snoozeUntil,
        alertType: subscription.alertType,
        percentageThreshold: subscription.percentageThreshold,
        baselinePrice: subscription.baselinePrice
      }];

      return product;
    } catch (error) {
      if (error instanceof BotError) throw error;

      logger.error('Error fetching product:', error);
      throw new BotError(
        'Failed to fetch product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch the product. Please try again later.'
      );
    }
  }

  static async getDealsUnified({ chatId, limit = 20, page = 1, sort = 'smart', scope = 'global' }) {
    const skip = (page - 1) * limit;
    let query = { isOutOfStock: false };

    // Filter by User if scope is 'user' and chatId is provided
    if (scope === 'user' && chatId) {
      const user = await User.findOne({ telegramId: chatId });
      if (user) {
        const subscriptions = await Subscription.find({ user: user._id }).select('product');
        const productIds = subscriptions.map(s => s.product);
        query['_id'] = { $in: productIds };
      } else {
        return { items: [], total: 0, page, totalPages: 0 };
      }
    }

    // Exclude hikes for "Top Deals" view (smart sort)
    if (sort === 'smart') {
      query.dealLabel = { $ne: 'price_hike' };
      // Also ensure we only show items with a positive score
      query.smartScore = { $gt: 0 };
    }

    let sortOptions = {};
    if (sort === 'smart') {
      sortOptions = { smartScore: -1 }; // High score first
    } else if (sort === 'date') {
      sortOptions = { lastDropDate: -1 }; // Most recent drop first
      // Also exclude hikes for "Newest" to show only relevant updates
      query.dealLabel = { $ne: 'price_hike' };
    } else {
      sortOptions = { smartScore: -1 };
    }

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);

    // Map to a consistent format
    const result = {
      items: items.map(p => ({
        product: p,
        // Map fields to match what the bot and dashboard expect
        currentPrice: p.currentPrice,
        oldPrice: p.lastPriceChange?.oldPrice || p.currentPrice,
        priceDiff: p.lastPriceChange?.diff || 0,
        percentChange: p.discountPercentage || 0,
        smartScore: p.smartScore || 0,
        dealLabel: p.dealLabel || 'fair_price',
        lastDropDate: p.lastDropDate,
        stats30d: {
          average: p.stats?.avg || 0,
          min: p.stats?.min || 0,
          max: p.stats?.max || 0
        },
        trend: p.aiPrediction || { trend: 'UNKNOWN' }
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };

    // If chatId is provided, enrich with user-specific tracker data
    if (chatId) {
      const user = await User.findOne({ telegramId: chatId });
      if (user) {
        const productIds = result.items.map(i => i.product._id);
        const subscriptions = await Subscription.find({
          user: user._id,
          product: { $in: productIds }
        });

        const subMap = new Map(subscriptions.map(s => [s.product.toString(), s]));

        result.items.forEach(item => {
          const pid = item.product._id.toString();
          const sub = subMap.get(pid);
          if (sub) {
            item.tracker = {
              chatId: chatId,
              thresholdPrice: sub.targetPrice,
              snoozeUntil: sub.snoozeUntil,
              alertType: sub.alertType,
              percentageThreshold: sub.percentageThreshold,
              baselinePrice: sub.baselinePrice
            };
            // Also attach to product for consistency if needed
            item.product.currentUserSubscription = sub;
          }
        });
      }
    }

    return result;
  }

  // Deprecated: Old in-memory implementation
  static async getDeals(chatId, scope = 'user') {
    // Forward to new unified method with default settings
    const result = await this.getDealsUnified({
      chatId,
      scope,
      limit: 50, // Default limit for bot (fetch enough for client-side pagination)
      sort: 'smart'
    });
    return result.items;
  }
}
