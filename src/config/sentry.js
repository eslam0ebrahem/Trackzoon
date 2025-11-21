import * as Sentry from '@sentry/node';

/**
 * Initialize Sentry for error monitoring
 * Set SENTRY_DSN in your environment variables to enable
 */
export const initSentry = () => {
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    console.log('⚠️  Sentry DSN not configured. Error monitoring disabled.');
    console.log('   To enable: Set SENTRY_DSN environment variable');
    return false;
  }

  Sentry.init({
    dsn: sentryDsn,
    environment: process.env.NODE_ENV || 'production',
    
    // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    
    // Capture unhandled promise rejections
    integrations: [
      new Sentry.Integrations.OnUncaughtException({
        exitEvenIfOtherHandlersAreRegistered: false,
      }),
      new Sentry.Integrations.OnUnhandledRejection({
        mode: 'warn',
      }),
    ],
    
    // Filter out sensitive data
    beforeSend(event, hint) {
      // Remove sensitive data from error reports
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }
      
      // Add custom tags
      event.tags = {
        ...event.tags,
        bot_name: 'Trackzoon',
        service: 'price-tracker',
      };
      
      return event;
    },
  });

  console.log('✅ Sentry error monitoring initialized');
  return true;
};

/**
 * Capture an exception with Sentry
 * @param {Error} error - The error to capture
 * @param {Object} context - Additional context
 */
export const captureError = (error, context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, {
      contexts: {
        custom: context,
      },
    });
  }
  
  // Always log to console as fallback
  console.error('Error captured:', error);
  if (Object.keys(context).length > 0) {
    console.error('Context:', context);
  }
};

/**
 * Capture a message with Sentry
 * @param {string} message - The message to capture
 * @param {string} level - Severity level (info, warning, error)
 * @param {Object} context - Additional context
 */
export const captureMessage = (message, level = 'info', context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage(message, {
      level,
      contexts: {
        custom: context,
      },
    });
  }
  
  console.log(`[${level.toUpperCase()}] ${message}`);
};

/**
 * Add user context to Sentry reports
 * @param {Object} user - User information
 */
export const setUserContext = (user) => {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser({
      id: user.chatId?.toString(),
      username: user.username,
    });
  }
};

/**
 * Add custom context to Sentry reports
 * @param {string} key - Context key
 * @param {Object} data - Context data
 */
export const setContext = (key, data) => {
  if (process.env.SENTRY_DSN) {
    Sentry.setContext(key, data);
  }
};

/**
 * Wrap async function with error handling
 * @param {Function} fn - Function to wrap
 * @param {string} operationName - Name for logging
 */
export const withErrorHandling = (fn, operationName = 'operation') => {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      captureError(error, {
        operation: operationName,
        args: JSON.stringify(args).substring(0, 200), // Limit size
      });
      throw error;
    }
  };
};

export default Sentry;
