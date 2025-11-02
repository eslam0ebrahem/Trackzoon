import { ProductService } from './services/productService.js';
import { UserService } from './services/userService.js';
import { stateManager, BotStates } from './utils/stateManager.js';
import { mainKeyboard } from './utils/keyboards/mainKeyboard.js';
import { BotError, ErrorCodes, handleError } from './utils/errorHandler.js';
import { resolveAmazonUrl } from './utils/url.js';
import { getProductName } from '../src/lib/scraper/getProductName.js';
import { getPrice } from '../src/lib/scraper/getPrice.js';
import { escapeMarkdownV2, buildProductListMessage, formatProductDetails } from './utils/messageHelper.js';
import { Messages } from './utils/messages.js';
import { Markup } from 'telegraf';
import mainActions from './actions/mainActions.js';
import productActions from './actions/productActions.js';
import settingsActions from './actions/settingsActions.js';

const registerHandlers = (bot) => {
  // Register all action handlers
  mainActions(bot);
  productActions(bot);
  settingsActions(bot);

  // Start command - entry point
  bot.command('start', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username;
      const welcomeMessage = escapeMarkdownV2([
        `👋 Welcome ${username} to Amazon Price Tracker!`,
        '',
        '🔍 Track Amazon prices and get instant alerts when they drop.',
        '',
        '✨ Choose an option from the menu below:'
      ].join('\n'));

      await ctx.reply(welcomeMessage, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Help command
  bot.command('help', async (ctx) => {
    try {
      const helpMessage = escapeMarkdownV2([
        '📚 *Available Commands*',
        '',
        '🔰 *Basic Commands:*',
        '/start \\- Start the bot and see welcome message',
        '/help \\- Show this help message',
        '/settings \\- Configure your preferences',
        '',
        '📦 *Product Management:*',
        '/add <URL> <price> \\- Add a new product to track',
        '/list \\- View all tracked products',
        '/removeone <ASIN or name> \\- Remove a tracked product',
        '/updateprice <ASIN or name> <new_price> \\- Update a product\'s alert price',
        '',
        '💡 *Pro Tips:*',
        '• Send an Amazon link directly to add a product',
        '• Use inline buttons for quick actions',
        '• Check /list regularly for price updates'
      ].join('\n'));

      await ctx.reply(helpMessage, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Add product command and flow
  bot.command('add', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL);
        return await ctx.reply(
          'Please provide the Amazon product URL and your desired price alert threshold\\.\n\n' +
          'Usage: /add <Amazon URL> <price threshold>\n' +
          'Example: /add https://amazon\\.com/dp/XXXXXX 299\\.99',
          { parse_mode: 'MarkdownV2' }
        );
      }

      let [, url, thresholdStr] = parts;
      const threshold = parseFloat(thresholdStr);
      if (isNaN(threshold) || threshold <= 0) {
        return await ctx.reply(
          'Please provide a valid price threshold \\(a positive number\\)\\.',
          { parse_mode: 'MarkdownV2' }
        );
      }

      await ctx.reply(
        'Processing your request\\.\\.\\.',
        { parse_mode: 'MarkdownV2' }
      );

      try {
        // Clean and validate URL
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          return await ctx.reply(
            'Please provide a valid Amazon product URL\\.',
            { parse_mode: 'MarkdownV2' }
          );
        }

        // Get product details
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        const currentPrice = await getPrice(resolvedUrl).catch(() => 0);

        if (currentPrice <= 0) {
          return await ctx.reply(
            'Unable to fetch the current price\\. Please try again later\\.',
            { parse_mode: 'MarkdownV2' }
          );
        }

        // Add or update tracker
        const { product, isNew } = await ProductService.addProduct(resolvedUrl, ctx.chat.id, threshold);

        // Show confirmation with current price context
        const message = isNew
          ? `✅ Added price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `Alert Price: £${threshold.toFixed(2)}`
          : `✅ Updated price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `New Alert Price: £${threshold.toFixed(2)}`;

        await ctx.reply(
          escapeMarkdownV2(message),
          { parse_mode: 'MarkdownV2' }
        );
      } catch (error) {
        if (error.code === ErrorCodes.PRODUCT_ALREADY_TRACKED) {
          return await ctx.reply(
            escapeMarkdownV2('You are already tracking this product.'),
            { parse_mode: 'MarkdownV2' }
          );
        }
        console.error('Error in add command:', error);
        await ctx.reply(
          'Error adding the product\. Please try again\.',
          { parse_mode: 'MarkdownV2' }
        );
      }
    } catch (error) {
      console.error('Unexpected error in add command:', error);
      await ctx.reply(
        'An unexpected error occurred\\. Please try again\\.',
        { parse_mode: 'MarkdownV2' }
      );
    }
  });

  // List products command
  bot.command('list', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const message = buildProductListMessage(products, ctx.chat.id);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard(),
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Settings command
  bot.command('settings', async (ctx) => {
    try {
      const user = await UserService.getUserSettings(ctx.chat.id);
      const message = buildSettingsMessage(user);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([[
        Markup.button.callback('⚙️ Settings', 'action_settings')]])
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.command('removeone', async (ctx) => {
    try {
      const identifier = ctx.message.text.split(' ').slice(1).join(' ');
      if (!identifier) {
        return await ctx.reply('Please provide a product ASIN or name to remove.');
      }

      const products = await ProductService.getUserProducts(ctx.chat.id);
      const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

      if (!product) {
        return await ctx.reply(`Could not find a product matching "${identifier}".`);
      }

      await ProductService.removeProduct(product.asin, ctx.chat.id);
      await ctx.reply(`Successfully removed ${product.name}.`);
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.command('updateprice', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        return await ctx.reply('Usage: /updateprice <ASIN or name> <new_price>');
      }

      const newPrice = parseFloat(parts.pop());
      const identifier = parts.slice(1).join(' ');

      if (isNaN(newPrice) || newPrice <= 0) {
        return await ctx.reply('Please provide a valid price.');
      }

      const products = await ProductService.getUserProducts(ctx.chat.id);
      const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

      if (!product) {
        return await ctx.reply(`Could not find a product matching "${identifier}".`);
      }

      await ProductService.updateThreshold(product.asin, ctx.chat.id, newPrice);
      await ctx.reply(`Successfully updated the alert price for ${product.name} to £${newPrice.toFixed(2)}.`);
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Handle text messages
  bot.on('text', async (ctx) => {
    try {
      const state = stateManager.getState(ctx.chat.id);

      if (!state) {
        return await ctx.reply('❓ I don\'t understand that command\\. Use /help to see available commands\\.', {
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      switch (state.state) {
        case BotStates.WAITING_FOR_URL:
          await handleProductUrl(ctx);
          break;

        case BotStates.WAITING_FOR_THRESHOLD:
          await handleThresholdInput(ctx);
          break;

        case BotStates.SETTING_THRESHOLD:
          await handleThresholdUpdate(ctx);
          break;

        default:
          if (ctx.message.text === 'Back') {
            stateManager.clearState(ctx.chat.id);
            return await ctx.reply('🔙 Back to main menu', {
              parse_mode: 'MarkdownV2',
              ...mainKeyboard()
            });
          }

          await ctx.reply('❓ I don\'t understand that command\\. Use /help to see available commands\\.', {
            parse_mode: 'MarkdownV2',
            ...mainKeyboard()
          });
      }
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Handle actions
  bot.action(/view_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const tracker = product.trackedBy.find(t => t.chatId === ctx.chat.id);

      const message = formatProductDetails(product, tracker);
      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: false,
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('📈 Price History', `action_history_${asin}`),
            Markup.button.callback('🎯 Set Threshold', `action_threshold_${asin}`)
          ],
          [
            Markup.button.callback('🔕 Mute Alerts', `action_mute_${asin}`),
            Markup.button.callback('❌ Stop Tracking', `action_remove_${asin}`)
          ],
          [Markup.button.callback('🔙 Back to Products', 'action_list_products')]
        ])
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action(/remove_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const name = escapeMarkdownV2(product.name);

      const message = escapeMarkdownV2(`❗️ *Confirm Removal*\n\nAre you sure you want to stop tracking:\n📦 [${name}](${product.url})?\n\nYou won't receive any more price alerts for this product.`);

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Yes, Remove', `action_confirm_remove_${asin}`),
            Markup.button.callback('❌ No, Keep', `action_cancel_remove_${asin}`)
          ]
        ]),
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action(/confirm_remove_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.removeProduct(asin, ctx.chat.id);
      const name = escapeMarkdownV2(product.name);

      let message = `✅ *Product Removed*\n\n`;
      message += `Successfully stopped tracking:\n`;
      message += `📦 [${name}](${product.url})\n\n`;
      message += `You can add it back anytime using /add\\.`;

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] },
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action('cancel_remove', async (ctx) => {
    try {
      const message = escapeMarkdownV2('✨ *Removal Cancelled*\n\nGreat! I\'ll continue tracking this product for you.');

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] }
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action(/setthreshold_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const product = await ProductService.getProduct(asin, ctx.chat.id);

      stateManager.setState(ctx.chat.id, BotStates.SETTING_THRESHOLD, { asin });

      const message = escapeMarkdownV2([
        '💰 Update Price Alert',
        '',
        `Current price for ${product.name}: £${product.currentPrice.toFixed(2)}`,
        'Enter your new desired price threshold\.'
      ].join('\n'));

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([
          [
            Markup.button.callback('5% off', `action_threshold_${asin}_5`),
            Markup.button.callback('10% off', `action_threshold_${asin}_10`),
            Markup.button.callback('20% off', `action_threshold_${asin}_20`)
          ],
          [
            Markup.button.callback('💭 Custom Threshold', `action_custom_threshold_${asin}`)
          ],
          [
            Markup.button.callback('🔙 Back', `action_view_${asin}`)
          ]
        ])
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action(/action_confirm_update_price_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const state = stateManager.getState(ctx.chat.id);

      if (!state || state.state !== BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION || state.data.asin !== asin) {
        return await ctx.reply(escapeMarkdownV2('❌ Invalid action or session expired. Please try again.'), { parse_mode: 'MarkdownV2' });
      }

      const { newThreshold, oldThreshold } = state.data;

      const product = await ProductService.updateThreshold(asin, ctx.chat.id, newThreshold);
      stateManager.clearState(ctx.chat.id);

      const productName = escapeMarkdownV2(product.name);
      const productUrlEscaped = escapeMarkdownV2(product.url);

      const message = [
        '✅ *Price Alert Updated*',
        '',
        `📦 Product: [${productName}](${productUrlEscaped})`,
        `💵 Current Price: £${product.currentPrice.toFixed(2)}`,
        `🎯 Old Alert Price: £${oldThreshold.toFixed(2)}`,
        `🆕 New Alert Price: £${newThreshold.toFixed(2)}`,
        '',
        'You will now receive alerts based on the new threshold.'
      ].join('\n');

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] },
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.action(/action_cancel_update_price_(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      const state = stateManager.getState(ctx.chat.id);

      if (!state || state.state !== BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION || state.data.asin !== asin) {
        return await ctx.reply(escapeMarkdownV2('❌ Invalid action or session expired. Please try again.'), { parse_mode: 'MarkdownV2' });
      }

      const { oldThreshold } = state.data;
      stateManager.clearState(ctx.chat.id);

      const product = await ProductService.getProduct(asin, ctx.chat.id);
      const productName = escapeMarkdownV2(product.name);
      const productUrlEscaped = escapeMarkdownV2(product.url);

      const message = [
        'ℹ️ *Price Update Canceled*',
        '',
        `📦 Product: [${productName}](${productUrlEscaped})`,
        `🎯 Your alert price remains: £${oldThreshold.toFixed(2)}`,
        '',
        'No changes were made to your tracking settings.'
      ].join('\n');

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: { inline_keyboard: [] },
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Settings menu removed
};

// Helper functions for handling user input
async function handleProductUrl(ctx) {
  try {
    const productUrl = ctx.message.text.trim();
    console.log('\nProcessing new URL request:', productUrl);

    // Basic URL validation first
    if (!productUrl.match(/^https?:\/\/(www\.)?(amazon\.|amzn\.)/i)) {
      throw new BotError('Invalid URL format', ErrorCodes.INVALID_URL);
    }

    await ctx.reply(escapeMarkdownV2('🔄 Processing URL... Please wait.'), {
      parse_mode: 'MarkdownV2'
    });

    console.log('URL passed validation, attempting to resolve...');
    const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

    console.log('Resolution results:', {
      originalUrl: productUrl,
      resolvedUrl: resolvedUrl,
      asin: asin
    });

    // Only throw error if we couldn't get either a resolved URL or ASIN
    if (!resolvedUrl || !asin) {
      throw new BotError('Invalid URL', ErrorCodes.INVALID_URL);
    }

    stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_THRESHOLD, {
      productUrl: resolvedUrl,
      asin
    });

    // Format the text for MarkdownV2
    const message = escapeMarkdownV2([
      '💰 Set Price Alert Threshold',
      '',
      'Please enter your desired price threshold\\. I\'ll notify you when the price drops below this amount\\.',
      '',
      '💡 Tips:',
      '• Enter the price in numbers \\(e\\.g\\. 299\\.99\\)',
      '• Set a realistic threshold \\- not too low\\!',
      '• You can update this later with /setthreshold',
      '',
      'Note: Price alerts only work when the price drops below your threshold\\.'
    ].join('\n'));

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.removeKeyboard()
    });
  } catch (error) {
    console.error('Error in handleProductUrl:', error);
    if (error instanceof BotError) throw error;
    // Only throw URL format error if it's actually a URL format issue
    if (error.message.includes('Invalid URL') || error.message.includes('INVALID_URL')) {
      throw new BotError(
        'Invalid URL format',
        ErrorCodes.INVALID_URL,
        escapeMarkdownV2(Messages.errors.invalidUrl)
      );
    }
    // For other errors, rethrow with a generic error message
    throw new BotError(
      'Error processing URL',
      ErrorCodes.GENERAL_ERROR,
      escapeMarkdownV2(Messages.errors.general)
    );
  }
}

async function handleThresholdInput(ctx) {
  const thresholdStr = ctx.message.text.trim();
  const threshold = parseFloat(thresholdStr);

  if (isNaN(threshold) || threshold <= 0) {
    throw new BotError(
      'Invalid threshold format',
      ErrorCodes.INVALID_THRESHOLD,
      escapeMarkdownV2([
        '❌ Invalid Price Format',
        '',
        '💡 Please follow these guidelines:',
        '• Use only numbers \\(e\\.g\\. 299\\.99\\)',
        '• Don\'t include currency symbols',
        '• Price must be greater than 0'
      ].join('\n'))
    );
  }

  const state = stateManager.getState(ctx.chat.id);
  const { productUrl, asin } = state.data;

  await ctx.reply(escapeMarkdownV2('🔄 Setting up price tracking\\.\\.\\. Please wait\\.'), {
    parse_mode: 'MarkdownV2'
  });

  const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(productUrl, ctx.chat.id, threshold);
  stateManager.clearState(ctx.chat.id);

  if (isAlreadyTracked) {
    const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;
    const productName = escapeMarkdownV2(product.name);
    const productUrlEscaped = escapeMarkdownV2(product.url);

    const message = [
      `⚠️ *Product Already Tracked*`,
      '',
      `📦 Product: [${productName}](${productUrlEscaped})`,
      `💵 Current Price: £${product.currentPrice.toFixed(2)}`,
      `🎯 Your current alert price: £${oldThreshold.toFixed(2)}`,
      `🆕 New proposed alert price: £${threshold.toFixed(2)}`,
      '',
      'Do you want to update your alert price to the new proposed price?'
    ].join('\n');

    stateManager.setState(ctx.chat.id, BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION, {
      asin,
      newThreshold: threshold,
      oldThreshold
    });

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('✅ Yes, update', `action_confirm_update_price_${asin}`)],
        [Markup.button.callback('❌ No, keep old', `action_cancel_update_price_${asin}`)]
      ]),
      disable_web_page_preview: true
    });
    return;
  }

  const difference = ((product.currentPrice - threshold) / threshold) * 100;
  const productName = escapeMarkdownV2(product.name);
  const productUrlEscaped = escapeMarkdownV2(product.url);

  const message = [
    '✅ *Product Added Successfully*',
    '',
    `📦 Product: [${productName}](${productUrlEscaped})`,
    `💵 Current Price: £${product.currentPrice.toFixed(2)}`,
    `🎯 Alert Price: £${threshold.toFixed(2)}`,
    '',
    product.currentPrice <= threshold
      ? '🎉 Good news\\! The current price is already below your alert threshold\\!'
      : [
        `📈 Current price is ${difference.toFixed(1)}% above your threshold\\.`,
        '🔔 I\'ll notify you when the price drops below your threshold\\!'
      ].join('\n')
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'MarkdownV2',
      ...mainKeyboard(),
    disable_web_page_preview: true
  });
}

async function handleThresholdUpdate(ctx) {
  const newThresholdStr = ctx.message.text.trim();
  const newThreshold = parseFloat(newThresholdStr);

  if (isNaN(newThreshold) || newThreshold <= 0) {
    throw new BotError(
      'Invalid threshold format',
      ErrorCodes.INVALID_THRESHOLD,
      '❌ Please enter a valid price number \\(e\\.g\\. 29\\.99\\)\\.\n\n' +
      '💡 Make sure to:\n' +
      '• Use only numbers and a decimal point\n' +
      '• Don\'t include currency symbols\n' +
      '• Enter a price greater than 0'
    );
  }

  const state = stateManager.getState(ctx.chat.id);
  const { asin } = state.data;

  await ctx.reply(escapeMarkdownV2(Messages.processing.updating), {
    parse_mode: 'MarkdownV2'
  });

  const product = await ProductService.updateThreshold(asin, ctx.chat.id, newThreshold);
  stateManager.clearState(ctx.chat.id);

  const difference = ((product.currentPrice - newThreshold) / newThreshold) * 100;
  const productName = escapeMarkdownV2(product.name);
  const productUrlEscaped = escapeMarkdownV2(product.url);

  const message = [
    '✅ *Price Alert Updated*',
    '',
    `📦 Product: [${productName}](${productUrlEscaped})`,
    `💵 Current Price: £${product.currentPrice.toFixed(2)}`,
    `🎯 New Alert Price: £${newThreshold.toFixed(2)}`,
    '',
    product.currentPrice <= newThreshold
      ? '🎉 Good news\\! The current price is already below your new alert threshold\\!'
      : [
        `📈 Current price is ${difference.toFixed(1)}% above your threshold\\.`,
        '🔔 I\'ll notify you when the price drops below your new threshold\\!'
      ].join('\n')
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'MarkdownV2',
    ...mainKeyboard(),
    disable_web_page_preview: true
  });
}

export default registerHandlers;