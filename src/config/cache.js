import Redis from 'ioredis';
import { captureError, captureMessage } from './sentry.js';

/**
 * Redis Cache Configuration
 * Provides caching for frequently accessed data
 */

let redisClient = null;
let isEnabled = false;
let evictionPolicy = null;
let evictionPolicyCheckedAt = null;
let policyCheckTimer = null;
let lastWarnedEvictionPolicy = null;
let policyCheckDisabled = false;

const POLICY_CHECK_INTERVAL_MS = 30 * 60 * 1000;

const extractEvictionPolicy = (configResult) => {
  if (!configResult) return null;
  if (Array.isArray(configResult)) {
    const idx = configResult.findIndex((item) => item === 'maxmemory-policy');
    if (idx >= 0 && typeof configResult[idx + 1] === 'string') {
      return configResult[idx + 1].trim().toLowerCase();
    }
    if (configResult.length >= 2 && typeof configResult[1] === 'string') {
      return configResult[1].trim().toLowerCase();
    }
  }
  if (typeof configResult === 'object' && typeof configResult['maxmemory-policy'] === 'string') {
    return configResult['maxmemory-policy'].trim().toLowerCase();
  }
  return null;
};

const isPolicyCheckPermissionError = (error) => {
  const message = error?.message?.toLowerCase?.() || '';
  return (
    message.includes('noperm') ||
    message.includes('noauth') ||
    message.includes('config|get') ||
    message.includes("command 'config'")
  );
};

const checkEvictionPolicy = async () => {
  if (!redisClient || policyCheckDisabled) return;
  try {
    const rawPolicy = await redisClient.config('GET', 'maxmemory-policy');
    evictionPolicy = extractEvictionPolicy(rawPolicy);
    evictionPolicyCheckedAt = new Date();

    if (evictionPolicy && evictionPolicy !== 'noeviction' && evictionPolicy !== lastWarnedEvictionPolicy) {
      const warningMessage = `IMPORTANT! Redis eviction policy is ${evictionPolicy}. It should be "noeviction"`;
      console.warn(warningMessage);
      captureMessage(warningMessage, 'warning', { redisEvictionPolicy: evictionPolicy });
      lastWarnedEvictionPolicy = evictionPolicy;
    }
  } catch (error) {
    if (isPolicyCheckPermissionError(error)) {
      policyCheckDisabled = true;
      const disabledMessage = 'Redis eviction policy check disabled: missing permissions for CONFIG GET.';
      console.warn(disabledMessage);
      captureMessage(disabledMessage, 'info', { redisError: error.message });
      if (policyCheckTimer) {
        clearInterval(policyCheckTimer);
        policyCheckTimer = null;
      }
      return;
    }
    console.warn(`Failed to inspect Redis eviction policy: ${error.message}`);
  }
};

/**
 * Initialize Redis connection
 * @returns {boolean} True if connected, false otherwise
 */
export const initCache = () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // if (!redisUrl) { ... } // Removed strict check to match priceQueue behavior

  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('Redis connection failed after 3 retries');
          return null; // Stop retrying
        }
        return Math.min(times * 50, 2000); // Exponential backoff
      }
    });

    redisClient.on('connect', () => {
      console.log('✅ Redis cache connected');
      isEnabled = true;
    });

    redisClient.on('ready', () => {
      checkEvictionPolicy().catch(() => {});
      if (!policyCheckTimer) {
        policyCheckTimer = setInterval(() => {
          checkEvictionPolicy().catch(() => {});
        }, POLICY_CHECK_INTERVAL_MS);
        policyCheckTimer.unref?.();
      }
    });

    redisClient.on('error', (error) => {
      console.error('Redis error:', error.message);
      captureError(error, { service: 'redis' });
      isEnabled = false;
    });

    redisClient.on('close', () => {
      console.log('⚠️  Redis connection closed');
      isEnabled = false;
      if (policyCheckTimer) {
        clearInterval(policyCheckTimer);
        policyCheckTimer = null;
      }
    });

    return true;
  } catch (error) {
    console.error('Failed to initialize Redis:', error);
    captureError(error, { operation: 'redis_init' });
    return false;
  }
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<any>} Cached value or null
 */
export const get = async (key) => {
  if (!isEnabled || !redisClient) {
    return null;
  }

  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error(`Cache get error for key ${key}:`, error.message);
    return null; // Fail gracefully
  }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds (default: 1 hour)
 * @returns {Promise<boolean>} Success status
 */
export const set = async (key, value, ttl = 3600) => {
  if (!isEnabled || !redisClient) {
    return false;
  }

  try {
    await redisClient.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Cache set error for key ${key}:`, error.message);
    return false;
  }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
export const del = async (key) => {
  if (!isEnabled || !redisClient) {
    return false;
  }

  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    console.error(`Cache delete error for key ${key}:`, error.message);
    return false;
  }
};

/**
 * Delete multiple keys matching pattern
 * @param {string} pattern - Key pattern (e.g., "product:*")
 * @returns {Promise<number>} Number of keys deleted
 */
export const deletePattern = async (pattern) => {
  if (!isEnabled || !redisClient) {
    return 0;
  }

  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length === 0) {
      return 0;
    }
    await redisClient.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`Cache delete pattern error for ${pattern}:`, error.message);
    return 0;
  }
};

/**
 * Check if cache is enabled
 * @returns {boolean} Cache status
 */
export const isCacheEnabled = () => isEnabled;

/**
 * Close Redis connection
 */
export const closeCache = async () => {
  if (policyCheckTimer) {
    clearInterval(policyCheckTimer);
    policyCheckTimer = null;
  }
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    isEnabled = false;
    evictionPolicy = null;
    evictionPolicyCheckedAt = null;
    lastWarnedEvictionPolicy = null;
    policyCheckDisabled = false;
    console.log('Redis cache closed');
  }
};

/**
 * Get raw Redis client
 */
export const getClient = () => redisClient;

/**
 * Get cache/redis health snapshot
 */
export const getCacheHealth = () => ({
  enabled: isEnabled,
  status: redisClient?.status || 'disconnected',
  evictionPolicy,
  evictionPolicyCheckedAt
});

/**
 * Cache key generators for consistency
 */
export const CacheKeys = {
  productName: (asin) => `product:name:${asin}`,
  resolvedUrl: (url) => `url:resolved:${Buffer.from(url).toString('base64').substring(0, 50)}`,
  productPrice: (asin) => `product:price:${asin}`,
  userProducts: (chatId) => `user:products:${chatId}`,
  productDetails: (asin, chatId) => `product:details:${asin}:${chatId}`,
};

/**
 * Cache TTL constants (in seconds)
 */
export const CacheTTL = {
  PRODUCT_NAME: 7 * 24 * 3600,      // 7 days (names rarely change)
  RESOLVED_URL: 30 * 24 * 3600,     // 30 days (URLs are permanent)
  PRODUCT_PRICE: 30 * 60,           // 30 minutes (matches check interval)
  USER_PRODUCTS: 5 * 60,            // 5 minutes (updated frequently)
  PRODUCT_DETAILS: 10 * 60,         // 10 minutes
};

export default {
  init: initCache,
  get,
  set,
  del,
  deletePattern,
  isEnabled: isCacheEnabled,
  getClient: () => redisClient,
  getHealth: getCacheHealth,
  close: closeCache,
  keys: CacheKeys,
  ttl: CacheTTL,
};
