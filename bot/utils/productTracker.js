// Utility functions for product tracking
import Product from '../models/Product.js';
import User from '../models/User.js';

export const addPriceTracker = async ({ asin, url, chatId, threshold, currentPrice, name, isPercentage = false }) => {
  try {
    let product = await Product.findOne({ asin });
    const now = new Date();
    
    if (!product) {
      product = new Product({
        asin,
        url,
        name,
        currentPrice,
        thresholdPrice: threshold, // Set main threshold price
        priceHistory: [{ price: currentPrice, date: now }],
        trackedBy: [],
        lastChecked: now,
        lastUpdated: now
      });
    }

    // Update or add tracker
    const existingTracker = product.trackedBy.find(t => t.chatId === chatId);
    if (existingTracker) {
      existingTracker.thresholdPrice = threshold;
      if (isPercentage) {
        existingTracker.percentageThreshold = threshold;
        existingTracker.alertType = 'percentage_drop';
      } else {
        existingTracker.percentageThreshold = null;
        existingTracker.alertType = 'drop';
      }
      existingTracker.lastAlertedAt = null; // Reset alert state for new threshold
      existingTracker.muteUntil = null;
    } else {
      product.trackedBy.push({
        chatId,
        thresholdPrice: threshold,
        percentageThreshold: isPercentage ? threshold : null,
        alertType: isPercentage ? 'percentage_drop' : 'drop',
        muteUntil: null,
        lastAlertedAt: null
      });
    }

    // Update product fields
    product.name = name; // Keep name up to date
    if (currentPrice > 0) {
      product.currentPrice = currentPrice;
      if (!product.priceHistory.some(ph => ph.price === currentPrice && ph.date.getTime() === now.getTime())) {
        product.priceHistory.push({ price: currentPrice, date: now });
      }
    }

    // For percentage tracking, update the actual threshold price
    if (isPercentage && currentPrice > 0) {
      const calculatedThreshold = currentPrice * (1 - threshold / 100);
      product.thresholdPrice = calculatedThreshold;
      if (existingTracker) {
        existingTracker.thresholdPrice = calculatedThreshold;
      } else {
        product.trackedBy[product.trackedBy.length - 1].thresholdPrice = calculatedThreshold;
      }
    }

    await product.save();

    // Update user's tracked products
    const user = await User.findOne({ chatId });
    if (user && !user.products.includes(product._id)) {
      user.products.push(product._id);
      await user.save();
    }

    return { 
      product, 
      isNew: !existingTracker,
      calculatedThreshold: isPercentage ? product.thresholdPrice : threshold
    };
  } catch (error) {
    console.error('Error adding price tracker:', error);
    throw error;
  }
};

export const validatePercentage = (percentage) => {
  const parsed = parseFloat(percentage);
  return !isNaN(parsed) && parsed > 0 && parsed <= 100 ? parsed : null;
};

export const validateThreshold = (threshold) => {
  const parsed = parseFloat(threshold);
  return !isNaN(parsed) && parsed > 0 ? parsed : null;
};