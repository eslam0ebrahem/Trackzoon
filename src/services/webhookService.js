import axios from 'axios';
import { logger } from '../utils/logger.js';

export const sendWebhook = async (url, eventType, payload) => {
    if (!url) return;

    try {
        await axios.post(url, {
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
        }, {
            timeout: 5000 // 5s timeout
        });
        logger.info(`Webhook sent to ${url} for event ${eventType}`);
    } catch (error) {
        logger.error(`Failed to send webhook to ${url}:`, error.message);
    }
};
