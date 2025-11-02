import { ProductService } from './services/productService.js';
import { UserService } from './services/userService.js';
import { stateManager, BotStates } from './utils/stateManager.js';
import { mainKeyboard } from './utils/keyboards/mainKeyboard.js';
import { BotError, ErrorCodes, handleError } from './utils/errorHandler.js';
import { resolveAmazonUrl } from './utils/url.js';
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
        '🔰 Basic Commands:',
        '/start \\- Start the bot and see welcome message',
        '/help \\- Show this help message',
        '/settings \\- Configure your preferences',
        '',
        '📦 Product Management:',
        '/add \\- Add a new product to track',
        '/list \\- View all tracked products',
        '/view \\- View details of a specific product',
        '/remove \\- Stop tracking a product',
        '',
        '⚡️ Price Alerts:',
        '/setthreshold \\- Set price alert threshold',
        '/history \\- View price history',
        '',
        '💡 Pro Tips:',
        '• Send an Amazon link directly to add a product',
        '• Use inline buttons for quick actions',
        '• Check /list regularly for price updates'
      ].join('\n'));

      await ctx.reply(helpMessage, {
        parse_mode: 'MarkdownV2',
        reply_markup: ProductKeyboards.mainMenu()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Add product command and flow
  bot.command('add', async (ctx) => {
    try {
      stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL);

      const message = escapeMarkdownV2([
        '🛍️ *Add a Product to Track*',
        '',
        'Please send me the Amazon product URL you want to track\\.',
        '',
        '💡 Tips:',
        '• Make sure it\'s a valid Amazon product URL',
        '• You can copy the URL directly from your browser',
        '• The URL should contain a product ID \\(ASIN\\)',
        '',
        '📝 Example:',
        'https://www\\.amazon\\.eg/dp/B08N5XSG8Z'
      ].join('\n'));

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: Markup.inlineKeyboard([[
        Markup.button.callback('🔙 Back to Main Menu', 'action_main_menu')
      ]]),
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // List products command
  bot.command('list', async (ctx) => {
    try {
      const products = await ProductService.getUserProducts(ctx.chat.id);
      const message = buildProductListMessage(products, ctx.chat.id);

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: ProductKeyboards.mainMenu(),
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
        reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback('⚙️ Settings', 'action_settings')]
      ])
      });
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
          reply_markup: ProductKeyboards.mainMenu(ctx)
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
              reply_markup: ProductKeyboards.mainMenu(ctx)
            });
          }

          await ctx.reply('❓ I don\'t understand that command\\. Use /help to see available commands\\.', {
            parse_mode: 'MarkdownV2',
            reply_markup: ProductKeyboards.mainMenu(ctx)
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
        `Current price for ${product.name}: $${product.currentPrice.toFixed(2)}`,
        'Enter your new desired price threshold\\.'
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

  const product = await ProductService.addProduct(productUrl, ctx.chat.id, threshold);
  stateManager.clearState(ctx.chat.id);

  const difference = ((product.currentPrice - threshold) / threshold) * 100;
  const message = escapeMarkdownV2([
    '✅ *Product Added Successfully*',
    '',
    `📦 Product: [${product.name}](${product.url})`,
    `💵 Current Price: $${product.currentPrice.toFixed(2)}`,
    `🎯 Alert Price: $${threshold.toFixed(2)}`,
    '',
    product.currentPrice <= threshold
      ? '🎉 Good news\\! The current price is already below your alert threshold\\!'
      : [
        `📈 Current price is ${difference.toFixed(1)}% above your threshold\\.`,
        '🔔 I\'ll notify you when the price drops below your threshold\\!'
      ].join('\n')
  ].join('\n'));

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
  const message = escapeMarkdownV2([
    '✅ *Price Alert Updated*',
    '',
    `📦 Product: [${product.name}](${product.url})`,
    `💵 Current Price: $${product.currentPrice.toFixed(2)}`,
    `🎯 New Alert Price: $${newThreshold.toFixed(2)}`,
    '',
    product.currentPrice <= newThreshold
      ? '🎉 Good news\\! The current price is already below your new alert threshold\\!'
      : [
        `📈 Current price is ${difference.toFixed(1)}% above your threshold\\.`,
        '🔔 I\'ll notify you when the price drops below your new threshold\\!'
      ].join('\n')
  ].join('\n'));

  await ctx.reply(message, {
    parse_mode: 'MarkdownV2',
    reply_markup: ProductKeyboards.mainMenu(ctx),
    disable_web_page_preview: true
  });
}

export default registerHandlers;