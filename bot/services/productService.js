import Product from '../models/Product.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { resolveAmazonUrl } from '../utils/url.js';

export class ProductService {
  static async addProduct(productUrl, chatId, threshold) {
    try {
      const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);
      
      if (!asin) {
        throw new BotError('Invalid Amazon URL', ErrorCodes.INVALID_URL);
      }

      let isNew = false;
      let isAlreadyTracked = false;
      // Check if product exists and is already tracked by user
      let product = await Product.findOne({ asin });
      if (product) {
        const isTracking = product.trackedBy.some(t => t.chatId === chatId);
        if (isTracking) {
          isAlreadyTracked = true;
          // No error thrown, just return the product and the flag
          return { product, isNew, isAlreadyTracked };
        }
      }

      // Product doesn't exist or not tracked by user
      if (!product) {
        isNew = true;
        const name = await getProductName(resolvedUrl);
        let currentPrice;
        
        // Try to get price, but handle out-of-stock gracefully
        try {
          currentPrice = await getPrice(resolvedUrl);
        } catch (priceError) {
          // If out of stock, use threshold as placeholder
          if (priceError.message.includes('out of stock') || priceError.message.includes('unavailable')) {
            console.log(`Product ${asin} is out of stock, tracking with threshold as placeholder`);
            currentPrice = threshold;
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
          priceHistory: [{ price: currentPrice, date: new Date() }],
          trackedBy: [{ chatId, thresholdPrice: threshold }]
        });
      } else {
        // If product exists but not tracked by user, add the new tracker
        product.trackedBy.push({ chatId, thresholdPrice: threshold });
      }

      await product.save();
      return { product, isNew, isAlreadyTracked };

    } catch (error) {
      if (error instanceof BotError) throw error;
      
      console.error('Error adding product:', error);
      throw new BotError(
        'Failed to add product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to add the product. Please try again later.'
      );
    }
  }

  static async removeProduct(asin, chatId) {
    try {
      const product = await Product.findOne({ asin, 'trackedBy.chatId': chatId });
      if (!product) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      product.trackedBy = product.trackedBy.filter(t => t.chatId !== chatId);
      
      if (product.trackedBy.length === 0) {
        await Product.deleteOne({ _id: product._id });
      } else {
        await product.save();
      }

      return product;

    } catch (error) {
      if (error instanceof BotError) throw error;
      
      console.error('Error removing product:', error);
      throw new BotError(
        'Failed to remove product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to remove the product. Please try again later.'
      );
    }
  }

  static async updateThreshold(asin, chatId, newThreshold) {
    try {
      const product = await Product.findOne({ asin, 'trackedBy.chatId': chatId });
      if (!product) {
        throw new BotError(
          'Product not found',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'Product not found or not tracked by you'
        );
      }

      const tracker = product.trackedBy.find(t => t.chatId === chatId);
      if (!tracker) {
        throw new BotError(
          'Product not tracked',
          ErrorCodes.PRODUCT_NOT_FOUND,
          'You are not tracking this product'
        );
      }

      tracker.thresholdPrice = newThreshold;
      await product.save();
      
      return product;

    } catch (error) {
      if (error instanceof BotError) throw error;
      
      console.error('Error updating threshold:', error);
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
      console.error('Error fetching user products:', error);
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
      
      console.error('Error fetching product:', error);
      throw new BotError(
        'Failed to fetch product',
        ErrorCodes.DATABASE_ERROR,
        'Failed to fetch the product. Please try again later.'
      );
    }
  }
}