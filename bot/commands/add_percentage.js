// bot/actions/add_percentage_action.js
import { i18next } from '../config/i18n.js';
import { resolveAmazonUrl } from '../utils/url.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { getProductName } from '../../src/lib/scraper/getProductName.js';
import { getPrice } from '../../src/lib/scraper/getPrice.js';

export default (bot, i18next) => {

  bot.command('add_percentage', async (ctx) => {

    const parts = ctx.message.text.split(' ');

    if (parts.length < 3) return ctx.reply(ctx.i18n('addPercentageUsage'));

    let [, url, percentageStr] = parts;



    const percentage = parseFloat(percentageStr);

    if (isNaN(percentage) || percentage <= 0 || percentage > 100) {

      return ctx.reply(ctx.i18n('invalidPercentage'));

    }



    ctx.reply(ctx.i18n('processing'));



    const markdownLinkMatch = url.match(/\[.*\]\((.*?)\)/);

    if (markdownLinkMatch && markdownLinkMatch[1]) {

      url = markdownLinkMatch[1];

    }



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

        currentPrice = 0;

      }



      product = new Product({

        asin,

        url,

        name,

        trackedBy: [{ chatId: ctx.chat.id, muteUntil: null, lastAlertedAt: null, alertType: 'percentage_drop', percentageThreshold: percentage }],

        thresholdPrice: currentPrice * (1 - percentage / 100), // Calculate initial threshold based on current price

        priceHistory: [{ price: currentPrice, date: new Date() }]

      });

      await product.save();

      // Add product to user's tracked products

      const user = await User.findOne({ chatId: ctx.chat.id });

      if (user && !user.products.includes(product._id)) {

        user.products.push(product._id);

        await user.save();

      }

      ctx.reply(ctx.i18n('addedPercentage', { name, percentage }));

    } else {

      const existingTracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);

      if (!existingTracker) {

        product.trackedBy.push({ chatId: ctx.chat.id, muteUntil: null, lastAlertedAt: null, alertType: 'percentage_drop', percentageThreshold: percentage });

        await product.save();

        // Add product to user's tracked products

        const user = await User.findOne({ chatId: ctx.chat.id });

        if (user && !user.products.includes(product._id)) {

          user.products.push(product._id);

          await user.save();

        }

        ctx.reply(ctx.i18n('addedPercentage', { name, percentage }));

      } else {

        ctx.reply(ctx.i18n('alreadyTracking', { name }));

      }

      const currentUserTracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);

      if (currentUserTracker) {

        currentUserTracker.percentageThreshold = percentage;

        currentUserTracker.alertType = 'percentage_drop';

        // Recalculate thresholdPrice based on current price if alertType is percentage_drop

        const latestPrice = product.priceHistory.length > 0 ? product.priceHistory.slice(-1)[0].price : 0;

        currentUserTracker.thresholdPrice = latestPrice * (1 - percentage / 100);

      }

      product.name = name;

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
