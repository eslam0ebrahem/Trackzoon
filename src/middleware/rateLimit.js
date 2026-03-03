import { logger } from '../utils/logger.js';

/**
 * Simple in-memory rate limiter middleware.
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds (default: 60000 = 1 min)
 * @param {number} options.max - Max requests per window per IP (default: 100)
 * @param {string} options.message - Error message when rate limited
 */
export const rateLimit = ({
    windowMs = 60 * 1000,
    max = 100,
    message = 'Too many requests, please try again later.'
} = {}) => {
    const hits = new Map();

    // Periodic cleanup to prevent memory leak
    const cleanupInterval = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of hits.entries()) {
            if (now - entry.resetTime >= windowMs) {
                hits.delete(key);
            }
        }
    }, windowMs * 2);
    cleanupInterval.unref?.();

    return (req, res, next) => {
        const key = req.ip || req.connection?.remoteAddress || 'unknown';
        const now = Date.now();

        let entry = hits.get(key);
        if (!entry || now - entry.resetTime >= windowMs) {
            entry = { count: 0, resetTime: now };
            hits.set(key, entry);
        }

        entry.count++;

        // Set rate limit headers
        const remaining = Math.max(0, max - entry.count);
        const resetAt = Math.ceil((entry.resetTime + windowMs) / 1000);
        res.set('X-RateLimit-Limit', String(max));
        res.set('X-RateLimit-Remaining', String(remaining));
        res.set('X-RateLimit-Reset', String(resetAt));

        if (entry.count > max) {
            logger.warn(`Rate limit exceeded for ${key}: ${entry.count}/${max} requests`);
            res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
            return res.status(429).json({ error: message });
        }

        next();
    };
};

// Pre-configured rate limiters for different use cases
export const apiRateLimit = rateLimit({ windowMs: 60 * 1000, max: 100 }); // 100 req/min
export const authRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 15, message: 'Too many login attempts, please try again later.' }); // 15 req/15min
export const writeRateLimit = rateLimit({ windowMs: 60 * 1000, max: 30, message: 'Too many write operations, please slow down.' }); // 30 req/min
