import { i18next } from './config/i18n.js';

import registerStartCommand from './commands/start.js';
import registerAddCommand from './commands/add.js';
import registerAddPercentageCommand from './commands/add_percentage.js';
import registerRemoveCommand from './commands/remove.js';
import registerListCommand from './commands/list.js';
import registerViewCommand from './commands/view.js';
import registerHistoryCommand from './commands/history.js';
import registerSetThresholdCommand from './commands/setthreshold.js';
import registerLangCommand from './commands/lang.js';
import registerSettingsCommand from './commands/settings.js';
import registerHelpCommand from './commands/help.js';

import registerAddProductAction from './actions/add_product.js';
import registerListProductsAction from './actions/list_products.js';
import registerShowHelpAction from './actions/show_help.js';
import registerRemoveProductAction from './actions/remove_product_action.js';
import registerCancelRemoveAction from './actions/cancel_remove_action.js';
import registerViewProductAction from './actions/view_product_action.js';
import registerHistoryAction from './actions/history_action.js';
import registerSetThresholdAction from './actions/setthreshold_action.js';
import registerSettingsLanguageAction from './actions/settings_language_action.js';
import registerSetLangAction from './actions/set_lang_action.js';

import Product from './models/Product.js'; // Keep for the text handler
import User from './models/User.js'; // Keep for the text handler
import axios from 'axios';
import { getProductName } from '../src/lib/scraper/getProductName.js';
import { getPrice } from '../src/lib/scraper/getPrice.js';
import { resolveAmazonUrl } from './utils/url.js';

const settingThreshold = new Map(); // To store asin for chatIds that are setting a threshold
const addingProductState = new Map(); // To store state for chatIds that are adding a product

const registerHandlers = (bot) => {
  registerStartCommand(bot);
  registerAddCommand(bot, addingProductState);
  registerAddPercentageCommand(bot);
  registerRemoveCommand(bot);
  registerListCommand(bot);
  registerViewCommand(bot);
  registerHistoryCommand(bot);
  registerSetThresholdCommand(bot);
  registerLangCommand(bot);
  registerSettingsCommand(bot);
  registerHelpCommand(bot);

  registerAddProductAction(bot, addingProductState);
  registerListProductsAction(bot);
  registerShowHelpAction(bot);
  registerRemoveProductAction(bot);
  registerCancelRemoveAction(bot);
  registerViewProductAction(bot);
  registerHistoryAction(bot);
  registerSetThresholdAction(bot, settingThreshold);
  registerSettingsLanguageAction(bot);
  registerSetLangAction(bot);

  bot.action(/setthreshold_value_(.+?)_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    const newThreshold = parseFloat(ctx.match[2]);

    const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

    if (!product) {
      return ctx.editMessageText(ctx.i18n('productNotFoundOrNotTracked'));
    }

    const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
    if (tracker) {
      tracker.thresholdPrice = newThreshold;
      await product.save();
      ctx.editMessageText(ctx.i18n('thresholdUpdated', { name: product.name, threshold: newThreshold }));
    } else {
      ctx.editMessageText(ctx.i18n('productNotFoundOrNotTracked'));
    }
    ctx.editMessageReplyMarkup({}); // Remove inline keyboard
  });

  bot.action(/setthreshold_custom_(.+)/, async (ctx) => {
    const asin = ctx.match[1];
    settingThreshold.set(ctx.chat.id, asin);
    ctx.editMessageText(ctx.i18n('promptNewThreshold'), { reply_markup: { remove_keyboard: true } });
  });

  bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;

    if (addingProductState.has(chatId)) {
      const state = addingProductState.get(chatId);

      if (state.step === 'waiting_for_url') {
        const productUrl = ctx.message.text;
        if (!productUrl) {
          return ctx.reply(ctx.i18n('promptForUrl'));
        }

        try {
          await ctx.reply(ctx.i18n('processing'));
          const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

          if (!asin) {
            return ctx.reply(ctx.i18n('invalidUrl'));
          }

          state.data.productUrl = resolvedUrl;
          state.data.asin = asin;
          state.step = 'waiting_for_threshold';
          addingProductState.set(chatId, state);
          return ctx.reply(ctx.i18n('promptForThreshold'));
        } catch (error) {
          console.error('Error resolving URL:', error);
          return ctx.reply(ctx.i18n('invalidUrl'));
        }
      } else if (state.step === 'waiting_for_threshold') {
        const thresholdStr = ctx.message.text;
        const threshold = parseFloat(thresholdStr);

        if (isNaN(threshold) || threshold <= 0) {
          return ctx.reply(ctx.i18n('invalidThreshold'));
        }

        const productUrl = state.data.productUrl;
        const asin = state.data.asin;
        addingProductState.delete(chatId); // Clear state

        try {
          await ctx.reply(ctx.i18n('processing'));

          // ASIN is already extracted in the previous step
          let product = await Product.findOne({ asin });

          if (product) {
            const isTracking = product.trackedBy.some(t => t.chatId === chatId);
            if (isTracking) {
              return ctx.reply(ctx.i18n('alreadyTracking', { name: product.name }));
            }
            product.trackedBy.push({ chatId, thresholdPrice: threshold });
            await product.save();
          } else {
            const name = await getProductName(productUrl);
            const currentPrice = await getPrice(productUrl);

            product = new Product({
              asin,
              name,
              url: productUrl,
              currentPrice,
              priceHistory: [{ price: currentPrice, date: new Date() }],
              trackedBy: [{ chatId, thresholdPrice: threshold }],
            });
            await product.save();
          }
          return ctx.reply(ctx.i18n('added', { name: product.name, threshold }));

        } catch (error) {
          console.error('Error adding product:', error);
          return ctx.reply(ctx.i18n('errorAddingProduct'));
        }
      }
    } else if (settingThreshold.has(chatId)) {
      const asin = settingThreshold.get(chatId);
      const newThresholdStr = ctx.message.text;
      const newThreshold = parseFloat(newThresholdStr);

      if (isNaN(newThreshold) || newThreshold <= 0) {
        settingThreshold.delete(chatId);
        return ctx.reply(ctx.i18n('invalidThreshold'));
      }

      const product = await Product.findOne({ asin, 'trackedBy.chatId': chatId });

      if (!product) {
        settingThreshold.delete(chatId);
        return ctx.reply(ctx.i18n('productNotFoundOrNotTracked'));
      }

      const tracker = product.trackedBy.find(t => t.chatId === chatId);
      if (tracker) {
        tracker.thresholdPrice = newThreshold;
        await product.save();
        ctx.reply(ctx.i18n('thresholdUpdated', { name: product.name, threshold: newThreshold }));
      } else {
        ctx.reply(ctx.i18n('productNotFoundOrNotTracked'));
      }
      settingThreshold.delete(chatId);
    }
  });
};

export default registerHandlers;