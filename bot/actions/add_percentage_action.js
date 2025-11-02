import { resolveAmazonUrl } from '../utils/url.js';
import { getProductName } from '../../src/lib/scraper/getProductName.js';
import { getPrice } from '../../src/lib/scraper/getPrice.js';
import { addPriceTracker, validatePercentage } from '../utils/productTracker.js';
import { setState, getState, clearState } from '../utils/stateManager.js';
import { parseAmazonUrl } from '../utils/urlParser.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

export default (bot) => {
  // Handle the initial action to start percentage tracking
  bot.action('add_percentage', async (ctx) => {
    try {
      setState(ctx.chat.id, { step: 'waiting_for_url' });
      await ctx.reply('Please send me the Amazon product URL to track with a percentage discount:', {
        reply_markup: { 
          force_reply: true,
          selective: true,
          input_field_placeholder: 'https://www.amazon.eg/dp/XXXXXXXXXX'
        }
      });
    } catch (error) {
      console.error('Error starting percentage tracking:', error);
      clearState(ctx.chat.id);
      await ctx.reply('Sorry, an unexpected error occurred. Please try again.');
    }
  });

  // Handle URL submission and ask for percentage
  bot.action(/add_percentage_url:(.+)/, async (ctx) => {
    try {
      const url = ctx.match[1];
      const state = getState(ctx.chat.id);
      
      if (!state || state.step !== 'waiting_for_url') {
        return await ctx.reply('Invalid request. Please start over with /add command.');
      }

      await ctx.reply('Processing your request...');

      try {
        const { resolvedUrl, asin } = await resolveAmazonUrl(url);
        if (!asin) {
          return await ctx.reply('Invalid Amazon URL. Please provide a valid Amazon product link.');
        }

        // Store URL and ASIN, wait for percentage
        setState(ctx.chat.id, { 
          step: 'waiting_for_percentage',
          url: resolvedUrl,
          asin
        });

        await ctx.reply('What percentage drop would you like to be notified about?', {
          reply_markup: {
            inline_keyboard: [
              [
                { text: '5%', callback_data: `add_percentage_value:${asin}:5` },
                { text: '10%', callback_data: `add_percentage_value:${asin}:10` },
                { text: '20%', callback_data: `add_percentage_value:${asin}:20` }
              ],
              [{ text: 'Custom Percentage', callback_data: `add_percentage_custom:${asin}` }]
            ]
          }
        });
      } catch (error) {
        console.error('Error processing URL:', error);
        clearState(ctx.chat.id);
        await ctx.reply('Error processing the URL. Please check the link and try again.');
      }
    } catch (error) {
      console.error('Error in percentage URL handler:', error);
      await ctx.reply('An unexpected error occurred. Please try again.');
    }
  });

  // Handle custom percentage input
  bot.action(/add_percentage_custom:(.+)/, async (ctx) => {
    try {
      const asin = ctx.match[1];
      setState(ctx.chat.id, { 
        step: 'waiting_for_custom_percentage',
        asin
      });
      await ctx.reply('Please enter your desired percentage drop (1-99):');
    } catch (error) {
      console.error('Error setting up custom percentage:', error);
      await ctx.reply('An unexpected error occurred. Please try again.');
    }
  });

  // Handle percentage selection/input
  bot.action(/add_percentage_value:(.+):(\d+)/, async (ctx) => {
    try {
      const [, asin, percentageStr] = ctx.match;
      const percentage = validatePercentage(percentageStr);
      
      if (!percentage) {
        return await ctx.reply('Please provide a valid percentage between 1 and 99.');
      }

      await ctx.reply('Processing your request...');

      try {
        const url = await resolveAmazonUrl(asin);
        const name = await getProductName(url).catch(() => `ASIN:${asin}`);
        const currentPrice = await getPrice(url).catch(() => 0);

        if (currentPrice <= 0) {
          return await ctx.reply('Unable to fetch the current price. Please try again later.');
        }

        const { product, isNew } = await addPriceTracker({
          asin,
          url,
          chatId: ctx.chat.id,
          threshold: percentage,
          currentPrice,
          name,
          isPercentage: true
        });

        const thresholdPrice = currentPrice * (1 - percentage / 100);
        
        const message = isNew 
          ? `✅ Added price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `Alert at: ${percentage}% drop (£${thresholdPrice.toFixed(2)})`
          : `✅ Updated price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `New alert: ${percentage}% drop (£${thresholdPrice.toFixed(2)})`;

        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        console.error('Error setting percentage:', error);
        await ctx.reply('Error adding the product. Please try again.');
      }
    } catch (error) {
      console.error('Error in percentage value handler:', error);
      await ctx.reply('An unexpected error occurred. Please try again.');
    }
  });

  // Handle text input for custom percentage
  bot.on('text', async (ctx) => {
    const chatId = ctx.chat.id;
    const state = getState(chatId);
    
    if (!state || state.step !== 'waiting_for_custom_percentage') {
      return; // Not waiting for percentage input
    }

    try {
      const percentage = validatePercentage(ctx.message.text);
      if (!percentage) {
        return await ctx.reply('Please provide a valid percentage between 1 and 99.');
      }

      const { asin } = state;
      clearState(chatId);

      await ctx.reply('Processing your request...');

      try {
        const url = await resolveAmazonUrl(asin);
        const name = await getProductName(url).catch(() => `ASIN:${asin}`);
        const currentPrice = await getPrice(url).catch(() => 0);

        if (currentPrice <= 0) {
          return await ctx.reply('Unable to fetch the current price. Please try again later.');
        }

        const { product, isNew } = await addPriceTracker({
          asin,
          url,
          chatId,
          threshold: percentage,
          currentPrice,
          name,
          isPercentage: true
        });

        const thresholdPrice = currentPrice * (1 - percentage / 100);
        
        const message = isNew 
          ? `✅ Added price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `Alert at: ${percentage}% drop (£${thresholdPrice.toFixed(2)})`
          : `✅ Updated price tracker for ${escapeMarkdownV2(product.name)}\n\n` +
            `Current Price: £${currentPrice.toFixed(2)}\n` +
            `New alert: ${percentage}% drop (£${thresholdPrice.toFixed(2)})`;

        await ctx.reply(message, { parse_mode: 'MarkdownV2' });
      } catch (error) {
        console.error('Error setting custom percentage:', error);
        await ctx.reply('Error adding the product. Please try again.');
      }
    } catch (error) {
      console.error('Error handling custom percentage:', error);
      clearState(chatId);
      await ctx.reply('An unexpected error occurred. Please try again.');
    }
  });
};
