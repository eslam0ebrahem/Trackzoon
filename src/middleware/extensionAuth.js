import { logger } from '../utils/logger.js';

export const extensionAuth = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const validApiKey = process.env.EXTENSION_API_KEY;

    if (!validApiKey) {
        logger.error('❌ EXTENSION_API_KEY is not set in environment variables!');
        return res.status(500).json({ error: 'Server configuration error' });
    }

    if (!apiKey || apiKey !== validApiKey) {
        logger.warn(`⚠️ Unauthorized extension access attempt from ${req.ip}`);
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
    }

    next();
};
