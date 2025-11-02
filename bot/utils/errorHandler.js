import { escapeMarkdownV2 } from './messageHelper.js';

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
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  PRODUCT_ALREADY_TRACKED: 'PRODUCT_ALREADY_TRACKED',
  SCRAPING_ERROR: 'SCRAPING_ERROR',
  DATABASE_ERROR: 'DATABASE_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR'
};

const errorMessages = {
  INVALID_URL: 'Please provide a valid Amazon product URL.',
  INVALID_THRESHOLD: 'Please provide a valid price threshold (a positive number).',
  PRODUCT_NOT_FOUND: 'Product not found. Please check the URL and try again.',
  PRODUCT_ALREADY_TRACKED: 'You are already tracking this product.',
  SCRAPING_ERROR: 'Unable to fetch product information. Please try again later.',
  DATABASE_ERROR: 'A database error occurred. Please try again.',
  TIMEOUT_ERROR: 'Request timed out. Please try again.',
};

export const handleError = async (ctx, error, defaultMessage = 'An unexpected error occurred. Please try again.') => {
  console.error(`Error in chat ${ctx.chat.id}:`, error);

  if (error instanceof BotError) {
    const message = error.userMessage || errorMessages[error.code] || defaultMessage;
    await ctx.reply(escapeMarkdownV2(message), {
      parse_mode: 'MarkdownV2'
    });
  } else {
    await ctx.reply(escapeMarkdownV2(defaultMessage), {
      parse_mode: 'MarkdownV2'
    });
  }
};