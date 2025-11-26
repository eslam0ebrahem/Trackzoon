import Product from '../models/Product.js';
import User from '../models/User.js';
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
        'Could not fetch product details. Please check the URL.'
      );
    }
  }

  static async addProduct(productUrl, chatId, threshold) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

      if (!asin) {
        throw new BotError('Invalid Amazon URL', ErrorCodes.INVALID_URL);
      }

      let isNew = false;
      let isAlreadyTracked = false;

      // Check if product exists and is already tracked by user
      let product = await Product.findOne({ asin }).session(session);
      if (product) {
        const isTracking = product.trackedBy.some(t => t.chatId === chatId);
        if (isTracking) {
          isAlreadyTracked = true;
          await session.abortTransaction();
          return { product, isNew, isAlreadyTracked };
        }
      }

      // Product doesn't exist or not tracked by user
      if (!product) {
        isNew = true;
        const name = await getProductName(resolvedUrl);
        let currentPrice;
        let isOutOfStock = false;

        let imageUrl = null;

        // Try to get price, but handle out-of-stock gracefully
        try {
          const scrapeResult = await getPrice(resolvedUrl);
          currentPrice = scrapeResult.currentPrice;
          imageUrl = scrapeResult.imageUrl;
        } catch (priceError) {
          // If out of stock (includes no-buybox scenarios), use threshold as placeholder
          if (priceError.message.includes('out of stock') ||
            priceError.message.includes('unavailable') ||
            priceError.message.includes('no-buybox')) {
            logger.info(`Product ${asin} is out of stock, tracking with threshold as placeholder`);
            currentPrice = threshold;
            isOutOfStock = true;
          } else {
            // For other errors, re-throw
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
          category, // AI Enhanced
          tags,     // AI Enhanced
          priceHistory: [{ price: currentPrice, date: new Date() }],
          trackedBy: [{ chatId, thresholdPrice: threshold }]
        });

        await product.save({ session });
      } else {
        // If product exists but not tracked by user, add the new tracker atomically
        product = await Product.findOneAndUpdate(
          { asin: asin },
          {
            $push: {
              trackedBy: { chatId, thresholdPrice: threshold }
            }
          },
          { new: true, session }
        );
      }

      // Update user's product list if User model exists
      await User.findOneAndUpdate(
        { chatId: chatId },
        {
          $addToSet: { products: product._id },
          $set: { lastActive: new Date() }
        },
        { session, upsert: false }
      ).catch(() => {
        // Ignore if user doesn't exist yet
        logger.warn(`User ${chatId} not found, skipping user update`);
      });

      await session.commitTransaction();
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
      const product = await Product.findOne({ asin, 'trackedBy.chatId': chatId }).session(session);
      if (!product) {
        await session.abortTransaction();
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      // Check if this is the last tracker
      const remainingTrackers = product.trackedBy.filter(t => t.chatId !== chatId);

      if (remainingTrackers.length === 0) {
        // Delete product if no one else is tracking it
        await Product.deleteOne({ _id: product._id }).session(session);
      } else {
        // Remove user from trackedBy array atomically
        await Product.findOneAndUpdate(
          { asin: asin },
          { $pull: { trackedBy: { chatId: chatId } } },
          { session }
        );
      }

      // Remove from user's product list
      await User.findOneAndUpdate(
        { chatId: chatId },
        { $pull: { products: product._id } },
        { session }
      ).catch(() => {
        logger.warn(`User ${chatId} not found, skipping user update`);
      });

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
      // Use atomic update to prevent race conditions
      const product = await Product.findOneAndUpdate(
        { asin: asin, 'trackedBy.chatId': chatId },
        { $set: { 'trackedBy.$.thresholdPrice': newThreshold } },
        { new: true }
      );

      if (!product) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

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

  static async snoozeProduct(asin, chatId, hours) {
    try {
      const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);

      const product = await Product.findOneAndUpdate(
        { asin: asin, 'trackedBy.chatId': chatId },
        { $set: { 'trackedBy.$.snoozeUntil': snoozeUntil } },
        { new: true }
      );

      if (!product) {
        throw new BotError('Product not found', ErrorCodes.PRODUCT_NOT_FOUND);
      }

      return product;
    } catch (error) {
      if (error instanceof BotError) throw error;
      logger.error('Error snoozing product:', error);
      throw new BotError('Failed to snooze product', ErrorCodes.DATABASE_ERROR);
    }
  }

  static async getUserProducts(chatId) {
    try {
      return await Product.find({ 'trackedBy.chatId': chatId });
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
      const product = await Product.findOne({ asin, 'trackedBy.chatId': chatId });
      if (!product) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }
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
      query['trackedBy.chatId'] = chatId;
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
    return {
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