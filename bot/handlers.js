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

const settingThreshold = new Map(); // To store asin for chatIds that are setting a threshold

const registerHandlers = (bot) => {
  registerStartCommand(bot, i18next);
  registerAddCommand(bot, i18next);
  registerAddPercentageCommand(bot, i18next);
  registerRemoveCommand(bot, i18next);
  registerListCommand(bot, i18next);
  registerViewCommand(bot, i18next);
  registerHistoryCommand(bot, i18next);
  registerSetThresholdCommand(bot, i18next);
  registerLangCommand(bot, i18next);
  registerSettingsCommand(bot, i18next);
  registerHelpCommand(bot, i18next);

  registerAddProductAction(bot, i18next);
  registerListProductsAction(bot, i18next);
  registerShowHelpAction(bot, i18next);
  registerRemoveProductAction(bot, i18next);
  registerCancelRemoveAction(bot, i18next);
  registerViewProductAction(bot, i18next);
  registerHistoryAction(bot, i18next);
  registerSetThresholdAction(bot, i18next, settingThreshold);
  registerSettingsLanguageAction(bot, i18next);
  registerSetLangAction(bot, i18next);

  bot.on('text', async (ctx) => {
    if (settingThreshold.has(ctx.chat.id)) {
      const asin = settingThreshold.get(ctx.chat.id);
      const newThresholdStr = ctx.message.text;
      const newThreshold = parseFloat(newThresholdStr);

      if (isNaN(newThreshold) || newThreshold <= 0) {
        settingThreshold.delete(ctx.chat.id);
        return ctx.reply(i18next.t('invalidThreshold'));
      }

      const product = await Product.findOne({ asin, 'trackedBy.chatId': ctx.chat.id });

      if (!product) {
        settingThreshold.delete(ctx.chat.id);
        return ctx.reply(i18next.t('productNotFoundOrNotTracked'));
      }

      const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);
      if (tracker) {
        tracker.thresholdPrice = newThreshold;
        await product.save();
        ctx.reply(i18next.t('thresholdUpdated', { name: product.name, threshold: newThreshold }));
      } else {
        ctx.reply(i18next.t('productNotFoundOrNotTracked'));
      }
      settingThreshold.delete(ctx.chat.id);
    }
  });
};

export default registerHandlers;