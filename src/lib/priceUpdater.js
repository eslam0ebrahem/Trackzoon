import Product from './models/Product.js';
import { getPrice } from './scraper/getPrice.js';
import mongoose from 'mongoose';

async function updateAllProductPrices(botInstance = null) {
  if (mongoose.connection.readyState !== 1) {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not defined');
    }
    await mongoose.connect(process.env.MONGODB_URI);
  }

  const products = await Product.find({});
  for (const product of products) {
    try {
      const currentPrice = await getPrice(product.url);
      const previousPrice = product.priceHistory.length > 0 ? product.priceHistory.slice(-1)[0].price : null;

      product.priceHistory.push({ price: currentPrice, date: new Date() });
      await product.save();

      // Alerting logic (only if botInstance is provided)
      if (botInstance) {
        for (const tracked of product.trackedBy) {
          if (tracked.muteUntil && new Date() < tracked.muteUntil) {
            continue; // Skip if muted
          }

          let shouldAlert = false;
          let alertMessage = '';

          if (tracked.alertType === 'drop' && tracked.thresholdPrice !== null) {
            if (currentPrice <= tracked.thresholdPrice) {
              shouldAlert = true;
              alertMessage = `Price for "${product.name}" is now ${currentPrice} EGP, which is at or below your set threshold of ${tracked.thresholdPrice} EGP.`;
            }
          } else if (tracked.alertType === 'percentage_drop' && tracked.percentageThreshold !== null && previousPrice !== null) {
            const dropAmount = previousPrice * (tracked.percentageThreshold / 100);
            if (currentPrice <= (previousPrice - dropAmount)) {
              shouldAlert = true;
              alertMessage = `Price for "${product.name}" has dropped by ${tracked.percentageThreshold}%! It's now ${currentPrice} EGP (was ${previousPrice} EGP).`;
            }
          }

          if (shouldAlert) {
            await botInstance.telegram.sendMessage(tracked.chatId, alertMessage);
            tracked.lastAlertedAt = new Date(); // Update last alerted time
          }
        }
        await product.save(); // Save product after updating lastAlertedAt
      }
    } catch (error) {
      console.error(`Failed to check price for ${product.name}:`, error);
    }
  }
}

export { updateAllProductPrices };
