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
          currentPrice = scrapeResult.price;
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

        product = new Product({
          asin,
          name,
          url: resolvedUrl,
          imageUrl,
          currentPrice,
          isOutOfStock,
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

  static async getDeals(chatId) {
    const products = await this.getUserProducts(chatId);
    const dealsData = [];

    // Helper to get old price
    const getPriceFrom24HoursAgo = (priceHistory) => {
      if (!priceHistory || priceHistory.length === 0) return null;
      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      let closestEntry = null;
      let closestDiff = Infinity;

      for (const entry of priceHistory) {
        const entryDate = new Date(entry.date);
        const timeDiff = Math.abs(entryDate.getTime() - twentyFourHoursAgo.getTime());
        if (timeDiff < closestDiff && timeDiff < 28 * 60 * 60 * 1000 && timeDiff > 20 * 60 * 60 * 1000) {
          closestDiff = timeDiff;
          closestEntry = entry;
        }
      }
      return closestEntry || (priceHistory.length > 0 ? priceHistory[0] : null);
    };

    products.forEach(product => {
      if (product.isOutOfStock || !product.currentPrice) return;
      const oldPriceEntry = getPriceFrom24HoursAgo(product.priceHistory);
      if (!oldPriceEntry) return;

      const oldPrice = oldPriceEntry.price;
      const currentPrice = product.currentPrice;
      const priceDiff = oldPrice - currentPrice;

      if (priceDiff > 0) {
        // Smart Validation: Check against 30-day average
        const stats30d = calculatePriceStats(product.priceHistory, 30);
        const statsAll = calculatePriceStats(product.priceHistory, 365); // All time

        // If we have stats, ensure current price is not significantly higher than average
        // We allow a small buffer (e.g., 5%) but generally it should be a real deal
        if (stats30d) {
          // If current price is > 5% above average, it's likely a fake deal
          if (currentPrice > stats30d.average * 1.05) {
            return; // Skip this deal
          }

          // Stricter check: If current price is > 40% above the 30-day LOW, it's not a "hot deal"
          if (currentPrice > stats30d.min * 1.4) {
            return; // Skip this deal
          }
        }

        const tracker = product.trackedBy.find(t => t.chatId === chatId);

        dealsData.push({
          product,
          oldPrice,
          currentPrice,
          priceDiff,
          percentChange: ((currentPrice - oldPrice) / oldPrice) * 100 * -1, // Positive percentage
          stats30d,
          statsAll,
          tracker
        });
      }
    });

    // Sort by biggest savings
    return dealsData.sort((a, b) => b.priceDiff - a.priceDiff);
  }
}