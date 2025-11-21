import { stateManager, BotStates } from '../utils/stateManager.js';
import { mainKeyboard } from '../utils/keyboards/mainKeyboard.js';
import { handleError, BotError, ErrorCodes } from '../utils/errorHandler.js';
import { resolveAmazonUrl, isValidAmazonUrl } from '../utils/url.js';
import { getProductName } from '../utils/scraper/getProductName.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { Markup } from 'telegraf';
import { ProductService } from '../services/productService.js';

async function handleProductUrl(ctx) {
    try {
        const productUrl = ctx.message.text.trim();
        // console.log('\nProcessing new URL request:', productUrl);

        // Basic URL validation first
        if (!isValidAmazonUrl(productUrl)) {
            throw new BotError('Invalid URL format', ErrorCodes.INVALID_URL);
        }

        const processingMsg = await ctx.reply(
            '🔄 *Processing\\.\\.\\.*\n\nValidating Amazon link\\.\\.\\.',
            { parse_mode: 'MarkdownV2' }
        );

        const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

        // Only throw error if we couldn't get either a resolved URL or ASIN
        if (!resolvedUrl || !asin) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });
            throw new BotError('Invalid URL', ErrorCodes.INVALID_URL);
        }

        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

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
        if (error instanceof BotError) throw error;
        if (error.message.includes('Invalid URL') || error.message.includes('INVALID_URL')) {
            throw new BotError(
                'Invalid URL format',
                ErrorCodes.INVALID_URL,
                escapeMarkdownV2('❌ Invalid Amazon link. Please send a valid Amazon product URL.')
            );
        }
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
        if (!isValidAmazonUrl(productUrl)) {
            throw new BotError('Invalid URL format', ErrorCodes.INVALID_URL);
        }

        const processingMsg = await ctx.reply(
            '🔄 *Processing\\.\\.\\.*\n\nFetching product details\\.\\.\\.',
            { parse_mode: 'MarkdownV2' }
        );

        const { resolvedUrl, asin } = await resolveAmazonUrl(productUrl);

        // Only throw error if we couldn't get either a resolved URL or ASIN
        if (!resolvedUrl || !asin) {
            await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });
            throw new BotError('Invalid URL', ErrorCodes.INVALID_URL);
        }

        // Get product details
        const name = await getProductName(resolvedUrl).catch(() => `ASIN:${asin}`);
        let currentPrice;
        let priceWarning = '';
        let isOutOfStock = false;

        try {
            const scrapeResult = await getPrice(resolvedUrl);
            currentPrice = scrapeResult.price;
            // You might want to pass imageUrl to the next step if needed, 
            // but for now just getting price is enough for this flow
            // or save it to session if you create product here
        } catch (err) {
            // Check if it's an out-of-stock error
            if (err.message.includes('out of stock') || err.message.includes('unavailable')) {
                isOutOfStock = true;
                currentPrice = threshold; // Use threshold as placeholder
                priceWarning = '\n\n⚠️ *Currently Out of Stock* \\- I\'ll notify you when available\\!';
            } else {
                // Allow adding product even without current price (it will be fetched later by scheduler)
                currentPrice = threshold; // Use threshold as placeholder
                priceWarning = '\n\n⚠️ *Note:* Current price unavailable\\. We\'ll fetch it in the next update\\.';
            }
        }

        // Additional check for invalid prices (only if not already out of stock)
        if (currentPrice <= 0 && !isOutOfStock) {
            currentPrice = threshold; // Use threshold as placeholder
            priceWarning = '\n\n⚠️ *Note:* Current price unavailable\\. We\'ll fetch it in the next update\\.';
        }

        // Delete processing message
        await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

        // Add or update tracker
        const { product, isNew, isAlreadyTracked } = await ProductService.addProduct(resolvedUrl, ctx.chat.id, threshold);
        stateManager.clearState(ctx.chat.id);

        // Use product's isOutOfStock flag (more reliable than local variable)
        isOutOfStock = product.isOutOfStock || false;
        if (isOutOfStock) {
            priceWarning = '\n\n⚠️ *Currently Out of Stock* \\- I\'ll notify you when available\\!';
        }

        // Handle already tracked case
        if (isAlreadyTracked) {
            const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;
            const productName = escapeMarkdownV2(product.name);

            const message = [
                `⚠️ *Product Already Tracked*`,
                '',
                `📦 [${productName}](${escapeMarkdownV2(product.url)})`,
                '',
                `💵 *Current Price:* EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
                `🎯 *Your Alert:* EGP${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
                `🆕 *Proposed Alert:* EGP${escapeMarkdownV2(threshold.toFixed(2))}`,
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
            `💰 *Current Price:* EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
            `🎯 *Alert Price:* EGP${escapeMarkdownV2(threshold.toFixed(2))}`,
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
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

    const productName = escapeMarkdownV2(product.name);
    const productUrlFromProduct = product.url;

    if (isAlreadyTracked) {
        const oldThreshold = product.trackedBy.find(t => t.chatId === ctx.chat.id).thresholdPrice;

        const message = [
            `⚠️ *Product Already Tracked*`,
            '',
            `📦 [${productName}](${escapeMarkdownV2(productUrlFromProduct)})`,
            '',
            `💵 *Current Price:* EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
            `🎯 *Your Alert:* EGP${escapeMarkdownV2(oldThreshold.toFixed(2))}`,
            `🆕 *New Alert:* EGP${escapeMarkdownV2(threshold.toFixed(2))}`,
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
        ` *Current Price:* EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
        `🎯 *Alert Price:* EGP${escapeMarkdownV2(threshold.toFixed(2))}`,
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
    await ctx.telegram.deleteMessage(ctx.chat.id, processingMsg.message_id).catch(() => { });

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
        `💰 *Current Price:* EGP${escapeMarkdownV2(product.currentPrice.toFixed(2))}`,
        `🎯 *New Alert:* EGP${escapeMarkdownV2(newThreshold.toFixed(2))}`,
        '',
        priceComparison
    ].join('\n');

    await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        ...mainKeyboard(),
        disable_web_page_preview: true
    });
}

export default (bot) => {
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
};
