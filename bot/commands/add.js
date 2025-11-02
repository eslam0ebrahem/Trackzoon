// bot/commands/add.js
import { i18next } from '../config/i18n.js';
import { resolveAmazonUrl } from '../utils/url.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { getProductName } from '../../src/lib/scraper/getProductName.js';
import { getPrice } from '../../src/lib/scraper/getPrice.js';

export default (bot, addingProductState) => {
  bot.command('add', async (ctx) => {
    const parts = ctx.message.text.split(' ');
    if (parts.length < 3) {
      addingProductState.set(ctx.chat.id, { step: 'waiting_for_url', data: {} });
      return ctx.reply(ctx.i18n('promptForUrl'));
    }
    let [, url, thresholdStr] = parts;

    const threshold = parseFloat(thresholdStr);
    if (isNaN(threshold) || threshold <= 0) {
      return ctx.reply(ctx.i18n('invalidThreshold'));
    }

    ctx.reply(ctx.i18n('processing'));

    // Extract URL from markdown link if present
    const markdownLinkMatch = url.match(/\[.*\]\((.*?)\)/);
    if (markdownLinkMatch && markdownLinkMatch[1]) {
      url = markdownLinkMatch[1];
    }

    // Resolve short links
    url = await resolveAmazonUrl(url);

    const asinMatch = url.match(/dp\/([A-Za-z0-9]{10})/);
    if (!asinMatch) return ctx.reply(ctx.i18n('invalidUrl'));

    const asin = asinMatch[1];
    let product = await Product.findOne({ asin });
    let name;
    try {
      name = await getProductName(url);
    } catch (err) {
      name = `ASIN:${asin}`;
    }

    if (!product) {
      let currentPrice;
      try {
        currentPrice = await getPrice(url);
      } catch (err) {
        console.error("Error fetching initial price:", err);
        currentPrice = 0; // Default to 0 or handle as appropriate
      }

      product = new Product({
        asin,
        url,
        name,
        trackedBy: [{ chatId: ctx.chat.id, muteUntil: null, lastAlertedAt: null, alertType: 'drop', percentageThreshold: null }],
        thresholdPrice: parseFloat(threshold),
        priceHistory: [{ price: currentPrice, date: new Date() }]
      });
      await product.save();
      // Add product to user's tracked products
      const user = await User.findOne({ chatId: ctx.chat.id });
      if (user && !user.products.includes(product._id)) {
        user.products.push(product._id);
        await user.save();
      }
      ctx.reply(ctx.i18n('added', { name, threshold }));
    } else {
      // Add chatId if not already present
      if (!product.trackedBy || !Array.isArray(product.trackedBy)) {
        product.trackedBy = []; // Initialize if undefined or not an array
      }
      const existingTracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
      if (!existingTracker) {
        product.trackedBy.push({ chatId: ctx.chat.id, muteUntil: null, lastAlertedAt: null, alertType: 'drop', percentageThreshold: null });
        await product.save();
        // Add product to user's tracked products
        const user = await User.findOne({ chatId: ctx.chat.id });
        if (user && !user.products.includes(product._id)) {
          user.products.push(product._id);
          await user.save();
        }
        ctx.reply(ctx.i18n('added', { name, threshold }));
      } else {
        ctx.reply(ctx.i18n('alreadyTracking', { name }));
      }
      // Update threshold for the current user (simple logic)
      const currentUserTracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
      if (currentUserTracker) {
        currentUserTracker.thresholdPrice = parseFloat(threshold);
        currentUserTracker.alertType = 'drop';
        currentUserTracker.percentageThreshold = null;
      }
      product.name = name; // Update product name in case it changed
      await product.save();
      // Add product to user's tracked products if not already there (in case it was just updated)
      const user = await User.findOne({ chatId: ctx.chat.id });
      if (user && !user.products.includes(product._id)) {
        user.products.push(product._id);
        await user.save();
      }
    }
  });
};
