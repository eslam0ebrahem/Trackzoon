import { captureError } from '../config/sentry.js';

/**
 * Retry utility with exponential backoff
 * Handles transient failures in Telegram API calls
 */

/**
 * Retry options
 * @typedef {Object} RetryOptions
 * @property {number} maxRetries - Maximum number of retry attempts (default: 3)
 * @property {number} initialDelay - Initial delay in ms (default: 1000)
 * @property {number} maxDelay - Maximum delay in ms (default: 10000)
 * @property {number} backoffMultiplier - Exponential backoff multiplier (default: 2)
 * @property {Function} shouldRetry - Function to determine if error is retryable
 */

const defaultOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  backoffMultiplier: 2,
  shouldRetry: (error) => {
    // Retry on network errors and rate limits
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }
    
    // Retry on Telegram API rate limits and server errors
    if (error.response) {
      const statusCode = error.response.error_code || error.response.status;
      return statusCode === 429 || statusCode >= 500;
    }
    
    return false;
  }
};

/**
 * Execute function with retry logic
 * @param {Function} fn - Async function to execute
 * @param {RetryOptions} options - Retry configuration
 * @returns {Promise<any>} Function result
 */
export const withRetry = async (fn, options = {}) => {
  const opts = { ...defaultOptions, ...options };
  let lastError;
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry if this is the last attempt
      if (attempt === opts.maxRetries) {
        break;
      }
      
      // Check if error is retryable
      if (!opts.shouldRetry(error)) {
        throw error; // Don't retry non-retryable errors
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelay * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelay
      );
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay;
      const finalDelay = delay + jitter;
      
      console.log(`Retry attempt ${attempt + 1}/${opts.maxRetries} after ${Math.round(finalDelay)}ms...`);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, finalDelay));
    }
  }
  
  // All retries exhausted
  console.error(`All ${opts.maxRetries} retry attempts failed`);
  captureError(lastError, {
    operation: 'retry_exhausted',
    maxRetries: opts.maxRetries
  });
  throw lastError;
};

/**
 * Send Telegram message with retry logic
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Chat ID
 * @param {string} message - Message text
 * @param {Object} options - Message options
 * @returns {Promise<Object>} Message result
 */
export const sendMessageWithRetry = async (bot, chatId, message, options = {}) => {
  return withRetry(
    () => bot.telegram.sendMessage(chatId, message, options),
    {
      maxRetries: 3,
      initialDelay: 1000,
      shouldRetry: (error) => {
        // Don't retry on user-related errors (blocked, chat not found, etc.)
        if (error.response) {
          const errorCode = error.response.error_code;
          if (errorCode === 403 || errorCode === 400) {
            console.log(`User ${chatId} blocked bot or chat not found, skipping retry`);
            return false;
          }
        }
        return defaultOptions.shouldRetry(error);
      }
    }
  );
};

/**
 * Edit Telegram message with retry logic
 * @param {Object} ctx - Telegraf context
 * @param {string} message - Message text
 * @param {Object} options - Message options
 * @returns {Promise<Object>} Message result
 */
export const editMessageWithRetry = async (ctx, message, options = {}) => {
  return withRetry(
    () => ctx.editMessageText(message, options),
    {
      maxRetries: 2, // Fewer retries for edits
      initialDelay: 500
    }
  );
};

/**
 * Answer callback query with retry logic
 * @param {Object} ctx - Telegraf context
 * @param {string} text - Callback text
 * @param {Object} options - Options
 * @returns {Promise<boolean>} Success status
 */
export const answerCallbackWithRetry = async (ctx, text, options = {}) => {
  return withRetry(
    () => ctx.answerCbQuery(text, options),
    {
      maxRetries: 2,
      initialDelay: 500
    }
  );
};

export default {
  withRetry,
  sendMessage: sendMessageWithRetry,
  editMessage: editMessageWithRetry,
  answerCallback: answerCallbackWithRetry,
};
