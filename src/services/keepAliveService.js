import axios from 'axios';
import { logger } from '../utils/logger.js';

const INTERVAL_MS = 14 * 60 * 1000; // 14 minutes
const REQUEST_TIMEOUT_MS = Math.max(2000, Number(process.env.KEEP_ALIVE_TIMEOUT_MS || 10000));

export const startKeepAlive = () => {
    const appUrl = process.env.RENDER_EXTERNAL_URL || process.env.APP_URL;

    if (!appUrl) {
        logger.warn('Keep-alive service not started: RENDER_EXTERNAL_URL or APP_URL not set.');
        return;
    }

    logger.info(`Starting keep-alive service for ${appUrl} with ${INTERVAL_MS}ms interval.`);

    // Initial ping after 10 seconds to verify connectivity
    const initialTimer = setTimeout(() => ping(appUrl), 10000);
    initialTimer.unref?.();

    // Regular interval
    const interval = setInterval(() => {
        ping(appUrl);
    }, INTERVAL_MS);
    interval.unref?.();
};

const ping = async (url) => {
    try {
        const response = await axios.get(url, {
            timeout: REQUEST_TIMEOUT_MS,
            maxRedirects: 3
        });
        logger.info(`Keep-alive ping successful: ${response.status} ${response.statusText}`);
    } catch (error) {
        logger.error(`Keep-alive ping failed: ${error.message}`);
    }
};
