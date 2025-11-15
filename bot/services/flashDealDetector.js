/**
 * Flash Deal Detector Service
 * Detects significant price drops (>20%) within 24 hours
 * and notifies users immediately
 */

import Product from '../models/Product.js';
import User from '../models/User.js';
import { sendMessage } from '../utils/messageHelper.js';

const FLASH_DEAL_THRESHOLD = 20; // 20% drop
const FLASH_DEAL_TIME_WINDOW = 24; // hours
const MIN_PRICE_FOR_FLASH_DEAL = 10; // Minimum £10 to avoid spam on cheap items

/**
 * Check if product has flash deal (>20% drop in last 24h)
 */
export const detectFlashDeal = (product) => {
  if (!product.priceHistory || product.priceHistory.length < 2) {
    return null;
  }

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - (FLASH_DEAL_TIME_WINDOW * 60 * 60 * 1000));
  
  // Get prices from last 24 hours
  const recentPrices = product.priceHistory
    .filter(h => new Date(h.date) >= cutoffTime)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  if (recentPrices.length < 2) {
    return null;
  }

  const oldestPrice = recentPrices[0].price;
  const currentPrice = product.currentPrice;

  // Skip if too cheap (avoid spam)
  if (currentPrice < MIN_PRICE_FOR_FLASH_DEAL) {
    return null;
  }

  const priceDrop = oldestPrice - currentPrice;
  const dropPercentage = (priceDrop / oldestPrice) * 100;

  if (dropPercentage >= FLASH_DEAL_THRESHOLD) {
    return {
      oldPrice: oldestPrice,
      newPrice: currentPrice,
      dropAmount: priceDrop,
      dropPercentage: dropPercentage.toFixed(1),
      timeFrame: FLASH_DEAL_TIME_WINDOW
    };
  }

  return null;
};

/**
 * Notify users about flash deals
 */
export const notifyFlashDeal = async (bot, product, flashDeal) => {
  try {
    const usersTracking = product.trackedBy || [];
    
    for (const tracker of usersTracking) {
      try {
        // Check if user was already notified about this flash deal recently
        const lastAlert = tracker.lastFlashDealAlert;
        if (lastAlert) {
          const hoursSinceLastAlert = (Date.now() - lastAlert.getTime()) / (1000 * 60 * 60);
          if (hoursSinceLastAlert < 6) {
            continue; // Don't spam, wait at least 6 hours
          }
        }

        const message = `
🔥 *FLASH DEAL ALERT!* 🔥

[${product.name}](${product.url})

💥 *${flashDeal.dropPercentage}% OFF* in last ${flashDeal.timeFrame} hours!

💰 Was: £${flashDeal.oldPrice.toFixed(2)}
✨ Now: £${flashDeal.newPrice.toFixed(2)}
📉 You Save: £${flashDeal.dropAmount.toFixed(2)}

⚡ This is a rare opportunity! Price might go back up soon.

${tracker.thresholdPrice && flashDeal.newPrice <= tracker.thresholdPrice 
  ? '🎯 *Also at or below your target price!*' 
  : tracker.thresholdPrice 
    ? `Your target: £${tracker.thresholdPrice.toFixed(2)}` 
    : ''
}
`;

        await sendMessage(bot, tracker.chatId, message, {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🛒 Buy Now', url: product.url }],
              [
                { text: '📊 View History', callback_data: `view_history_${product.asin}` },
                { text: '🔕 Stop Tracking', callback_data: `remove_${product.asin}` }
              ]
            ]
          }
        });

        // Update last alert timestamp
        tracker.lastFlashDealAlert = new Date();
        await product.save();

        // Track savings potential
        const user = await User.findOne({ chatId: tracker.chatId });
        if (user) {
          // User could save this much if they buy
          user.savings.flashDeals += flashDeal.dropAmount;
          user.savings.total += flashDeal.dropAmount;
          user.savings.history.push({
            amount: flashDeal.dropAmount,
            type: 'flash_deal',
            productName: product.name,
            productUrl: product.url,
            originalPrice: flashDeal.oldPrice,
            finalPrice: flashDeal.newPrice,
            date: new Date()
          });
          await user.save();
        }

      } catch (error) {
        console.error(`Error notifying user ${tracker.chatId} about flash deal:`, error);
      }
    }
  } catch (error) {
    console.error('Error in notifyFlashDeal:', error);
  }
};

/**
 * Scan all products for flash deals
 * Should be called periodically (e.g., every hour)
 */
export const scanForFlashDeals = async (bot) => {
  try {
    console.log('🔍 Scanning for flash deals...');
    
    // Get all tracked products
    const products = await Product.find({ 
      'trackedBy.0': { $exists: true },
      isOutOfStock: false,
      currentPrice: { $gt: 0 }
    });

    let flashDealsFound = 0;

    for (const product of products) {
      const flashDeal = detectFlashDeal(product);
      
      if (flashDeal) {
        console.log(`⚡ Flash deal detected: ${product.name} - ${flashDeal.dropPercentage}% off`);
        await notifyFlashDeal(bot, product, flashDeal);
        flashDealsFound++;
      }
    }

    console.log(`✅ Flash deal scan complete. Found ${flashDealsFound} deals.`);
    return flashDealsFound;

  } catch (error) {
    console.error('Error in scanForFlashDeals:', error);
    return 0;
  }
};

/**
 * Get flash deal statistics for a user
 */
export const getFlashDealStats = async (chatId) => {
  try {
    const user = await User.findOne({ chatId }).populate('products');
    
    if (!user || !user.products) {
      return null;
    }

    const activeFlashDeals = [];
    const potentialSavings = {
      total: 0,
      count: 0
    };

    for (const product of user.products) {
      const flashDeal = detectFlashDeal(product);
      if (flashDeal) {
        activeFlashDeals.push({
          product: {
            name: product.name,
            url: product.url,
            currentPrice: product.currentPrice
          },
          deal: flashDeal
        });
        potentialSavings.total += flashDeal.dropAmount;
        potentialSavings.count++;
      }
    }

    return {
      activeDeals: activeFlashDeals,
      potentialSavings,
      historicalSavings: {
        total: user.savings.flashDeals || 0,
        history: user.savings.history.filter(h => h.type === 'flash_deal')
      }
    };

  } catch (error) {
    console.error('Error getting flash deal stats:', error);
    return null;
  }
};

export default {
  detectFlashDeal,
  notifyFlashDeal,
  scanForFlashDeals,
  getFlashDealStats
};
