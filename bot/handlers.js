import { ProductService } from './services/productService.js';
import { UserService } from './services/userService.js';
import { stateManager, BotStates } from './utils/stateManager.js';
import { mainKeyboard } from './utils/keyboards/mainKeyboard.js';
import { BotError, ErrorCodes, handleError } from './utils/errorHandler.js';
import { resolveAmazonUrl } from './utils/url.js';
import { getProductName } from './utils/scraper/getProductName.js';
import { getPrice } from './utils/scraper/getPrice.js';
import { escapeMarkdownV2, buildProductListMessage, formatProductDetails, buildDailyReportMessage, buildSettingsMessage } from './utils/messageHelper.js';
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
      
      // Register user if new
      await UserService.getOrCreateUser(ctx.chat.id, username);
      
      const welcomeMessage = [
        `👋 *Welcome ${escapeMarkdownV2(username)}\\!*`,
        '',
        `I'm your personal Amazon price tracker\\. I'll help you save money by tracking product prices and notifying you when they drop\\!`,
        '',
        `🌟 *What I can do:*`,
        `• Track Amazon product prices 24/7`,
        `• Send instant alerts when prices drop`,
        `• Show price history and trends`,
        `• Help you find the best time to buy`,
        '',
        `🚀 *Quick Start:*`,
        `Just send me any Amazon product link to start tracking\\!`,
        '',
        `Or use the menu below to explore more options\\.\\.\\.`
      ].join('\n');

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
      const helpMessage = [
        '📚 *Help \\& Commands*',
        '',
        '🎯 *Quick Actions:*',
        '• Just send me an Amazon link to start tracking\\!',
        '• Use buttons below for easy navigation',
        '',
        '� *Available Commands:*',
        '',
        '*Basic:*',
        '/start \\- Restart the bot',
        '/help \\- Show this help',
        '/list \\- View all tracked products',
        '/report \\- Get your daily price report',
        '',
        '*Product Management:*',
        '/add <URL> <price> \\- Track a product',
        '   Example: `/add https://amzn\\.to/xxx 99\\.99`',
        '/removeone <ASIN> \\- Stop tracking a product',
        '',
        '*Settings:*',
        '/settings \\- Manage preferences',
        '',
        '💡 *Pro Tips:*',
        '• Set realistic price alerts',
        '• Check /list daily for deals',
        '• Enable daily reports in /settings',
        '• Products are checked automatically',
        '• You get instant notifications',
        '',
        '❓ Need more help? Just ask\\!'
      ].join('\n');

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
        stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_URL_AND_PRICE);
        const message = [
          '🛍️ *Track a New Product*',
          '',
          '📝 *Send me:*',
          '`<Amazon URL> <alert price>`',
          '',
          '💡 *Examples:*',
          '• `https://amzn\\.to/xxx 99\\.99`',
          '• `https://amazon\\.co\\.uk/dp/B085P5NY9H 68`',
          '',
          '⚡ *One step \\- that\'s it\\!*'
        ].join('\n');
        
        return await ctx.reply(message, { 
          parse_mode: 'MarkdownV2',
          ...mainKeyboard()
        });
      }

      let [, url, thresholdStr] = parts;
      const threshold = parseFloat(thresholdStr);
      if (isNaN(threshold) || threshold <= 0) {
        return await ctx.reply(
          escapeMarkdownV2('❌ Please provide a valid price (a positive number).'),
          { parse_mode: 'MarkdownV2' }
        );
      }

      const processingMsg = await ctx.reply(
        '🔄 *Processing\\.\\.\\.*\n\nFetching product details\\.\\.\\.',
        { parse_mode: 'MarkdownV2' }
      );

      try {
        // Clean and validate URL
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
          return await ctx.reply(
            escapeMarkdownV2('❌ Invalid Amazon URL. Please provide a valid product link.'),
            { parse_mode: 'MarkdownV2', ...mainKeyboard() }
          );
        }

        // Get product details
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        const currentPrice = await getPrice(resolvedUrl).catch(() => 0);

        if (currentPrice <= 0) {
          await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
          return await ctx.reply(
            escapeMarkdownV2('❌ Unable to fetch the current price. Please try again later.'),
            { parse_mode: 'MarkdownV2', ...mainKeyboard() }
          );
        }

        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

        // Add or update tracker
        const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(resolvedUrl, ctx.chat.id, threshold);

        // Handle already tracked case
        if (isAlreadyTracked) {
          const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;
          const productName = escapeMarkdownV2(product.name);

          const message = [
            `⚠️ *Product Already Tracked*`,
            '',
            `📦 [${productName}](${escapeMarkdownV2(product.url)})`,
            '',
            `💵 *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
            `🎯 *Your Alert:* £${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
            `🆕 *Proposed Alert:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
            '',
            escapeMarkdownV2('Would you like to update your alert price?')
          ].join('\n');

          stateManager.setState(ctx.chat.id, BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION, {
            asin,
            newThreshold: threshold,
            oldThreshold
          });

          return await ctx.reply(message, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
              inline_keyboard: [
                [{ text: '✅ Yes, Update', callback_data: `action_confirm_update_price_${asin}` }],
                [{ text: '❌ Keep Current', callback_data: `action_cancel_update_price_${asin}` }]
              ]
            },
            disable_web_page_preview: true
          });
        }

        // Calculate savings/difference
        const difference = currentPrice - threshold;
        const percentDiff = ((difference / threshold) * 100).toFixed(1);
        
        // Show confirmation with current price context
        const priceComparison = difference > 0 
          ? `📈 *${escapeMarkdownV2(percentDiff)}% above your alert*`
          : difference < 0
          ? `🎉 *Already ${escapeMarkdownV2(Math.abs(percentDiff))}% below target\\!*`
          : `✅ *Price matches your target\\!*`;

        const message = [
          isNew ? '✅ *Product Added Successfully\\!*' : '✅ *Product Updated\\!*',
          '',
          `📦 [${escapeMarkdownV2(product.name)}](${product.url})`,
          '',
          `💰 *Current Price:* £${escapeMarkdownV2(currentPrice.toFixed(2))}`,
          `🎯 *Alert Price:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
          '',
          priceComparison,
          '',
          difference > 0 
            ? `🔔 I'll notify you when the price drops\\!`
            : `🎊 Great timing\\! This is a good deal\\!`
        ].join('\n');

        await ctx.reply(message, {
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: true,
          ...mainKeyboard()
        });
      } catch (error) {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        
        if (error.code === ErrorCodes.PRODUCT_ALREADY_TRACKED) {
          return await ctx.reply(
            escapeMarkdownV2('❌ You are already tracking this product.'),
            { parse_mode: 'MarkdownV2', ...mainKeyboard() }
          );
        }
        console.error('Error in add command:', error);
        await ctx.reply(
          escapeMarkdownV2('❌ Error adding the product. Please try again.'),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }
    } catch (error) {
      console.error('Unexpected error in add command:', error);
      await ctx.reply(
        escapeMarkdownV2('❌ An unexpected error occurred. Please try again.'),
        { parse_mode: 'MarkdownV2', ...mainKeyboard() }
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
        reply_markup: {
          inline_keyboard: [[
            { text: '⚙️ Settings', callback_data: 'action_settings' }
          ]]
        }
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.command('removeone', async (ctx) => {
    try {
      const identifier = ctx.message.text.split(' ').slice(1).join(' ');
      if (!identifier) {
        return await ctx.reply(
          escapeMarkdownV2('Please provide a product ASIN or name to remove.'),
          { parse_mode: 'MarkdownV2' }
        );
      }

      const products = await ProductService.getUserProducts(ctx.chat.id);
      const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

      if (!product) {
        return await ctx.reply(
          escapeMarkdownV2(`Could not find a product matching "${identifier}".`),
          { parse_mode: 'MarkdownV2' }
        );
      }

      // Show confirmation before removing
      const productName = escapeMarkdownV2(product.name);
      const message = [
        '❗️ *Confirm Removal*',
        '',
        'Are you sure you want to stop tracking:',
        `📦 [${productName}](${escapeMarkdownV2(product.url)})?`,
        '',
        escapeMarkdownV2("You won't receive any more price alerts for this product.")
      ].join('\n');

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Remove', callback_data: `action_confirm_remove_${product.asin}` },
              { text: '❌ No, Keep', callback_data: `action_cancel_remove_${product.asin}` }
            ]
          ]
        },
        disable_web_page_preview: true
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  bot.command('updateprice', async (ctx) => {
    try {
      const parts = ctx.message.text.split(' ');
      if (parts.length < 3) {
        return await ctx.reply(
          escapeMarkdownV2('❌ Usage: /updateprice <ASIN or name> <new_price>'),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }

      const newPrice = parseFloat(parts.pop());
      const identifier = parts.slice(1).join(' ');

      if (isNaN(newPrice) || newPrice <= 0) {
        return await ctx.reply(
          escapeMarkdownV2('❌ Please provide a valid price.'),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }

      const processingMsg = await ctx.reply(
        '🔄 *Updating price alert\\.\\.\\.*',
        { parse_mode: 'MarkdownV2' }
      );

      const products = await ProductService.getUserProducts(ctx.chat.id);
      const product = products.find(p => p.asin === identifier || p.name.toLowerCase().includes(identifier.toLowerCase()));

      if (!product) {
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
        return await ctx.reply(
          escapeMarkdownV2(`❌ Could not find a product matching "${identifier}".`),
          { parse_mode: 'MarkdownV2', ...mainKeyboard() }
        );
      }

      await ProductService.updateThreshold(product.asin, ctx.chat.id, newPrice);
      
      // Delete processing message
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

      const message = [
        '✅ *Price Alert Updated\\!*',
        '',
        `📦 ${escapeMarkdownV2(product.name)}`,
        `🎯 New Alert Price: £${escapeMarkdownV2(newPrice.toFixed(2))}`,
        '',
        '🔔 You will be notified when the price drops to this level\\!'
      ].join('\n');

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard()
      });
    } catch (error) {
      handleError(ctx, error);
    }
  });

  // Daily report command
  bot.command('report', async (ctx) => {
    try {
      const user = await UserService.getOrCreateUser(ctx.chat.id, ctx.from?.first_name || ctx.from?.username);
      const products = await ProductService.getUserProducts(ctx.chat.id);
      
      const reportMessage = buildDailyReportMessage(
        products.map(p => ({
          ...p.toObject(),
          trackedBy: p.trackedBy.filter(t => t.chatId === ctx.chat.id)
        })),
        user.firstName || user.username || 'there'
      );
      
      await ctx.reply(reportMessage, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true,
        ...mainKeyboard()
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
          ...mainKeyboard()
        });
      }

      switch (state.state) {
        case BotStates.WAITING_FOR_URL:
          await handleProductUrl(ctx);
          break;

        case BotStates.WAITING_FOR_URL_AND_PRICE:
          await handleUrlAndPrice(ctx);
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
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📈 Price History', callback_data: `action_history_${asin}` },
              { text: '🎯 Set Threshold', callback_data: `action_threshold_${asin}` }
            ],
            [
              { text: '❌ Stop Tracking', callback_data: `action_remove_${asin}` }
            ],
            [{ text: '🔙 Back to Products', callback_data: 'action_list_products' }]
          ]
        }
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

      const message = `❗️ *Confirm Removal*\n\nAre you sure you want to stop tracking:\n📦 [${name}](${escapeMarkdownV2(product.url)})?\n\nYou won\'t receive any more price alerts for this product.`;

      await ctx.editMessageText(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Yes, Remove', callback_data: `action_confirm_remove_${asin}` },
              { text: '❌ No, Keep', callback_data: `action_cancel_remove_${asin}` }
            ]
          ]
        },
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
      message += `📦 [${name}](${escapeMarkdownV2(product.url)})\n\n`;
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
        reply_markup: {
          inline_keyboard: [
            [
              { text: '5% off', callback_data: `action_threshold_${asin}_5` },
              { text: '10% off', callback_data: `action_threshold_${asin}_10` },
              { text: '20% off', callback_data: `action_threshold_${asin}_20` }
            ],
            [
              { text: '💭 Custom Threshold', callback_data: `action_custom_threshold_${asin}` }
            ],
            [
              { text: '🔙 Back', callback_data: `action_view_${asin}` }
            ]
          ]
        }
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
      const productUrl = product.url;

      const message = [
        '✅ *Price Alert Updated*',
        '',
        `📦 Product: [${productName}](${escapeMarkdownV2(productUrl)})`,
        `💵 Current Price: £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
        `🎯 Old Alert Price: £${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
        `🆕 New Alert Price: £${escapeMarkdownV2(newThreshold.toFixed(2))}`,
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
      const productUrl = product.url;

      const message = [
        'ℹ️ *Price Update Canceled*',
        '',
        `📦 Product: [${productName}](${escapeMarkdownV2(productUrl)})`,
        `🎯 Your alert price remains: £${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
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

    const processingMsg = await ctx.reply(
      '🔄 *Processing\\.\\.\\.*\n\nValidating Amazon link\\.\\.\\.',
      { parse_mode: 'MarkdownV2' }
    );

    console.log('URL passed validation, attempting to resolve...');
    const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

    console.log('Resolution results:', {
      originalUrl: productUrl,
      resolvedUrl: resolvedUrl,
      asin: asin
    });

    // Only throw error if we couldn't get either a resolved URL or ASIN
    if (!resolvedUrl || !asin) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
      throw new BotError('Invalid URL', ErrorCodes.INVALID_URL);
    }

    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

    // Get product name for better UX
    let productName;
    try {
      productName = await getProductName(resolvedUrl);
    } catch (e) {
      productName = `Product ${asin}`;
    }

    stateManager.setState(ctx.chat.id, BotStates.WAITING_FOR_THRESHOLD, {
      productUrl: resolvedUrl,
      asin,
      productName
    });

    // Format the message with product name
    const message = [
      '🎯 *Set Your Price Alert*',
      '',
      `📦 Product: ${escapeMarkdownV2(productName)}`,
      '',
      `💰 *Enter your target price:*`,
      `When the price drops to or below this amount, I'll notify you immediately\\!`,
      '',
      `💡 *Example:* 99\\.99`,
      '',
      `*Tips:*`,
      `• Enter only numbers \\(no currency symbols\\)`,
      `• Set a realistic target price`,
      `• You can change this anytime later`
    ].join('\n');

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
        escapeMarkdownV2('❌ Invalid Amazon link. Please send a valid Amazon product URL.')
      );
    }
    // For other errors, rethrow with a generic error message
    throw new BotError(
      'Error processing URL',
      ErrorCodes.GENERAL_ERROR,
      escapeMarkdownV2('❌ Error processing your link. Please try again.')
    );
  }
}

async function handleUrlAndPrice(ctx) {
  try {
    const text = ctx.message.text.trim();
    console.log('\nProcessing combined URL + price request:', text);

    // Split the input to extract URL and price
    const parts = text.split(/\s+/);
    
    // Need at least 2 parts: URL and price
    if (parts.length < 2) {
      throw new BotError(
        'Invalid format',
        ErrorCodes.INVALID_INPUT,
        [
          '❌ *Invalid Format*',
          '',
          '💡 *Please send in this format:*',
          '`<Amazon URL> <price>`',
          '',
          '*Examples:*',
          '• `https://amzn\\.to/xxx 99\\.99`',
          '• `https://amazon\\.co\\.uk/dp/B085P5NY9H 68`',
          '',
          'Try again:'
        ].join('\n')
      );
    }

    // Last part should be the price
    const priceStr = parts[parts.length - 1];
    const threshold = parseFloat(priceStr);

    if (isNaN(threshold) || threshold <= 0) {
      throw new BotError(
        'Invalid price',
        ErrorCodes.INVALID_THRESHOLD,
        [
          '❌ *Invalid Price*',
          '',
          '💡 *Please provide a valid price:*',
          '• Must be a number greater than 0',
          '• Example: 99\\.99',
          '',
          '*Format:*',
          '`<Amazon URL> <price>`',
          '',
          'Try again:'
        ].join('\n')
      );
    }

    // Everything except the last part is the URL
    const productUrl = parts.slice(0, -1).join(' ');

    // Basic URL validation
    if (!productUrl.match(/^https?:\/\/(www\.)?(amazon\.|amzn\.)/i)) {
      throw new BotError('Invalid URL format', ErrorCodes.INVALID_URL);
    }

    const processingMsg = await ctx.reply(
      '🔄 *Processing\\.\\.\\.*\n\nFetching product details\\.\\.\\.',
      { parse_mode: 'MarkdownV2' }
    );

    console.log('URL passed validation, attempting to resolve...');
    const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

    console.log('Resolution results:', {
      originalUrl: productUrl,
      resolvedUrl: resolvedUrl,
      asin: asin,
      threshold: threshold
    });

    // Only throw error if we couldn't get either a resolved URL or ASIN
    if (!resolvedUrl || !asin) {
      await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});
      throw new BotError('Invalid URL', ErrorCodes.INVALID_URL);
    }

    // Get product details
    const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
    let currentPrice = await getPrice(resolvedUrl).catch((err) => {
      console.error('Error fetching price:', err.message);
      return 0;
    });

    // Allow adding product even without current price (it will be fetched later by scheduler)
    let priceWarning = '';
    if (currentPrice <= 0) {
      console.log('Price not available now, will be checked by scheduler');
      currentPrice = threshold; // Use threshold as placeholder
      priceWarning = '\n\n⚠️ *Note:* Current price unavailable\\. We\'ll fetch it in the next update\\.';
    }

    // Delete processing message
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

    // Add or update tracker
    const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(resolvedUrl, ctx.chat.id, threshold);
    stateManager.clearState(ctx.chat.id);

    // Handle already tracked case
    if (isAlreadyTracked) {
      const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;
      const productName = escapeMarkdownV2(product.name);

      const message = [
        `⚠️ *Product Already Tracked*`,
        '',
        `📦 [${productName}](${escapeMarkdownV2(product.url)})`,
        '',
        `💵 *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
        `🎯 *Your Alert:* £${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
        `🆕 *Proposed Alert:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
        '',
        escapeMarkdownV2('Would you like to update your alert price?')
      ].join('\n');

      stateManager.setState(ctx.chat.id, BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION, {
        asin,
        newThreshold: threshold,
        oldThreshold
      });

      return await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Yes, Update', callback_data: `action_confirm_update_price_${asin}` }],
            [{ text: '❌ Keep Current', callback_data: `action_cancel_update_price_${asin}` }]
          ]
        },
        disable_web_page_preview: true
      });
    }

    // Calculate price difference
    const difference = ((product.currentPrice - threshold) / threshold) * 100;
    const percentDiff = difference.toFixed(1);
    const productName = escapeMarkdownV2(product.name);

    // Build success message (check if price was actually fetched)
    let priceStatus = '';
    if (priceWarning) {
      // Price wasn't available
      priceStatus = [
        `🔔 I'll check the price automatically`,
        `and notify you when it drops to your target\\.`
      ].join('\n');
    } else {
      // Normal price comparison
      priceStatus = product.currentPrice <= threshold
        ? [
            `🎉 *Great News\\!*`,
            `The current price is already below your target\\!`,
            `This is a good time to buy\\!`
          ].join('\n')
        : [
            `📊 Current price is *${escapeMarkdownV2(percentDiff)}%* above your target\\.`,
            `🔔 Don't worry\\! I'll notify you immediately when the price drops\\.`
          ].join('\n');
    }

    const message = [
      '✅ *Tracking Started\\!*',
      '',
      `📦 [${productName}](${escapeMarkdownV2(product.url)})`,
      '',
      `💰 *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
      `🎯 *Alert Price:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
      '',
      priceStatus,
      priceWarning,
      '',
      '✨ You can view all your tracked products anytime with /list'
    ].join('\n');

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      ...mainKeyboard(),
      disable_web_page_preview: true
    });
  } catch (error) {
    console.error('Error in handleUrlAndPrice:', error);
    if (error instanceof BotError) throw error;
    // Only throw URL format error if it's actually a URL format issue
    if (error.message.includes('Invalid URL') || error.message.includes('INVALID_URL')) {
      throw new BotError(
        'Invalid URL format',
        ErrorCodes.INVALID_URL,
        escapeMarkdownV2('❌ Invalid Amazon link. Please send a valid Amazon product URL.')
      );
    }
    // For other errors, rethrow with a generic error message
    throw new BotError(
      'Error processing request',
      ErrorCodes.GENERAL_ERROR,
      escapeMarkdownV2('❌ Error processing your request. Please try again.')
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
      [
        '❌ *Invalid Price*',
        '',
        '💡 *Please enter a valid number:*',
        '• Example: 99\\.99',
        '• No currency symbols',
        '• Must be greater than 0',
        '',
        'Try again:'
      ].join('\n')
    );
  }

  const state = stateManager.getState(ctx.chat.id);
  const { productUrl, asin, productName: savedProductName } = state.data;

  const processingMsg = await ctx.reply(
    '⏳ *Setting up your alert\\.\\.\\.*',
    { parse_mode: 'MarkdownV2' }
  );

  const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(productUrl, ctx.chat.id, threshold);
  stateManager.clearState(ctx.chat.id);

  // Delete processing message
  await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

  const productName = escapeMarkdownV2(product.name);
  const productUrlFromProduct = product.url;

  if (isAlreadyTracked) {
    const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;

    const message = [
      `⚠️ *Product Already Tracked*`,
      '',
      `📦 [${productName}](${escapeMarkdownV2(productUrlFromProduct)})`,
      '',
      `💵 *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
      `🎯 *Your Alert:* £${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
      `🆕 *New Alert:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
      '',
      escapeMarkdownV2('Would you like to update your alert price?')
    ].join('\n');

    stateManager.setState(ctx.chat.id, BotStates.AWAITING_PRICE_UPDATE_CONFIRMATION, {
      asin,
      newThreshold: threshold,
      oldThreshold
    });

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Yes, Update', callback_data: `action_confirm_update_price_${asin}` }],
          [{ text: '❌ Keep Current', callback_data: `action_cancel_update_price_${asin}` }]
        ]
      },
      disable_web_page_preview: true
    });
    return;
  }

  // Calculate price difference
  const difference = ((product.currentPrice - threshold) / threshold) * 100;
  const percentDiff = difference.toFixed(1);

  // Build success message
  const priceStatus = product.currentPrice <= threshold
    ? [
        `🎉 *Great News\\!*`,
        `The current price is already below your target\\!`,
        `This is a good time to buy\\!`
      ].join('\n')
    : [
        `📊 Current price is *${escapeMarkdownV2(percentDiff)}%* above your target\\.`,
        `🔔 Don't worry\\! I'll notify you immediately when the price drops\\.`
      ].join('\n');

  const message = [
    '✅ *Tracking Started\\!*',
    '',
    `📦 [${productName}](${escapeMarkdownV2(productUrlFromProduct)})`,
    '',
    `� *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
    `🎯 *Alert Price:* £${escapeMarkdownV2(threshold.toFixed(2))}`,
    '',
    priceStatus,
    '',
    '✨ You can view all your tracked products anytime with /list'
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
      [
        '❌ *Invalid Price*',
        '',
        '💡 *Please enter a valid number:*',
        '• Example: 99\\.99',
        '• No currency symbols',
        '• Must be greater than 0',
        '',
        'Try again:'
      ].join('\n')
    );
  }

  const state = stateManager.getState(ctx.chat.id);
  const { asin } = state.data;

  const processingMsg = await ctx.reply(
    '🔄 *Updating price alert\\.\\.\\.*',
    { parse_mode: 'MarkdownV2' }
  );

  const product = await ProductService.updateThreshold(asin, ctx.chat.id, newThreshold);
  stateManager.clearState(ctx.chat.id);

  // Delete processing message
  await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => {});

  const difference = ((product.currentPrice - newThreshold) / newThreshold) * 100;
  const productName = escapeMarkdownV2(product.name);
  const productUrl = product.url;

  const priceComparison = product.currentPrice <= newThreshold
    ? '🎉 Good news\\! The current price is already below your new alert threshold\\!'
    : [
        `📈 Current price is ${escapeMarkdownV2(difference.toFixed(1))}% above your threshold\\.`,
        '🔔 I will notify you when the price drops below your new threshold\\!'
      ].join('\n');

  const message = [
    '✅ *Price Alert Updated\\!*',
    '',
    `📦 [${productName}](${escapeMarkdownV2(productUrl)})`,
    '',
    `💰 *Current Price:* £${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
    `🎯 *New Alert:* £${escapeMarkdownV2(newThreshold.toFixed(2))}`,
    '',
    priceComparison
  ].join('\n');

  await ctx.reply(message, {
    parse_mode: 'MarkdownV2',
    ...mainKeyboard(),
    disable_web_page_preview: true
  });
}

export default registerHandlers;