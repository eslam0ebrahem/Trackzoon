import Product from '../models/Product.js';
import User from '../models/User.js';
import mongoose from 'mongoose';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { resolveAmazonUrl } from '../utils/url.js';
import { logger } from '../utils/logger.js';

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

        // Try to get price, but handle out-of-stock gracefully
        try {
          currentPrice = await getPrice(resolvedUrl);
        } catch (priceError) {
          // If out of stock, use threshold as placeholder
          if (priceError.message.includes('out of stock') || priceError.message.includes('unavailable')) {
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
}