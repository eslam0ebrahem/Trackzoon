import { escapeMarkdownV2 } from './messageHelper.js';
import { mainKeyboard } from './keyboards/mainKeyboard.js';
import { captureError } from '../config/sentry.js';

export class BotError extends Error {
  constructor(message, code, userMessage = null) {
    super(message);
    this.name = 'BotError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export const ErrorCodes = {
  INVALID_URL: 'INVALID_URL',
  INVALID_THRESHOLD: 'INVALID_THRESHOLD',
  INVALID_INPUT: 'INVALID_INPUT',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_ALREADY_TRACKED: 'PRODUCT_ALREADY_TRACKED',
  SCRAPING_ERROR: 'SCRAPING_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  STATE_ERROR: 'STATE_ERROR',
  PERMISSION_ERROR: 'PERMISSION_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  NETWORK_ERROR: 'NETWORK_ERROR',
  GENERAL_ERROR: 'GENERAL_ERROR'
};

const errorMessages = {
  INVALID_URL: 'Please provide a valid Amazon product URL.',
  INVALID_THRESHOLD: 'Please provide a valid price threshold (a positive number).',
  INVALID_INPUT: 'Please provide valid input for this operation.',
  PRODUCT_NOT_FOUND: 'Product not found. Please check the URL and try again.',
  PRODUCT_ALREADY_TRACKED: 'You are already tracking this product.',
  SCRAPING_ERROR: 'Unable to fetch product information. Please try again later.',
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
  STATE_ERROR: 'Invalid operation for current state. Please start over.',
  PERMISSION_ERROR: 'You don\'t have permission to perform this action.',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again.',
  NETWORK_ERROR: 'Network error. Please check your connection and try again.',
  GENERAL_ERROR: 'Something went wrong. Please try again.'
};

export const handleError = async (ctx, error, defaultMessage = 'An unexpected error occurred. Please try again.') => {
  console.error(`Error in chat ${ctx.chat.id}:`, error);
  
  // Capture error in Sentry with context
  captureError(error, {
    chatId: ctx.chat?.id,
    username: ctx.from?.username,
    command: ctx.message?.text || ctx.callbackQuery?.data,
    updateType: ctx.updateType,
  });

  const isCallback = ctx.updateType === 'callback_query';
  let showMainMenu = true;

  // Determine if we should show main menu based on error type
  if (error instanceof BotError) {
    showMainMenu = ![
      ErrorCodes.INVALID_THRESHOLD,
      ErrorCodes.INVALID_URL,
      ErrorCodes.STATE_ERROR
    ].includes(error.code);
  }

  try {
    const message = error instanceof BotError
      ? (error.userMessage || errorMessages[error.code] || defaultMessage)
      : defaultMessage;

    const errorMessage = escapeMarkdownV2(`❌ *Error*\n\n${message}`);

    if (isCallback) {
      // For callback queries, answer the query first
      await ctx.answerCbQuery('❌ Error').catch(console.error);
      
      // Check if the message is a photo (can't edit text on photo messages)
      const hasPhoto = ctx.callbackQuery?.message?.photo;
      
      if (hasPhoto) {
        // If it's a photo message, send a new message instead
        await ctx.reply(errorMessage, {
          parse_mode: 'MarkdownV2',
          ...(showMainMenu ? mainKeyboard() : {})
        }).catch(console.error);
      } else {
        // If it's a text message, edit it
        await ctx.editMessageText(errorMessage, {
          parse_mode: 'MarkdownV2',
          ...(showMainMenu ? mainKeyboard() : {})
        }).catch(console.error);
      }
    } else {
      // For regular messages, just send a new message
      await ctx.reply(errorMessage, {
        parse_mode: 'MarkdownV2',
        ...(showMainMenu ? mainKeyboard() : {})
      });
    }
  } catch (handlingError) {
    // If error handling fails, try one last simple message
    console.error('Error while handling error:', handlingError);
    const finalMessage = isCallback ? 
      ctx.answerCbQuery('An error occurred') :
      ctx.reply('An error occurred');
    
    await finalMessage.catch(console.error);
  }
};

// Timeout middleware
export const timeoutHandler = async (ctx, next) => {
  try {
    // Set a timeout for long operations
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new BotError(
        'Operation timed out',
        ErrorCodes.TIMEOUT_ERROR,
        'This operation took too long. Please try again.'
      )), 30000);
    });

    // Race between the actual operation and timeout
    await Promise.race([next(), timeout]);
  } catch (error) {
    await handleError(ctx, error);
  }
};
