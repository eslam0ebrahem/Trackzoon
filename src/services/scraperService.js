import pLimit from 'p-limit';
import { getPrice } from '../utils/scraper/getPrice.js';
import { logger } from '../utils/logger.js';
import { BotError, ErrorCodes } from '../utils/errorHandler.js';

// Rate limiter: Max 3 concurrent scraping requests
const scrapingLimit = pLimit(3);

export class ScraperService {
    constructor() {
        this.consecutiveCaptchaCount = 0;
        this.coolDownUntil = null;
    }

    async scrapeProduct(url) {
        // Circuit Breaker Check
        if (this.coolDownUntil && Date.now() < this.coolDownUntil) {
            const minutesLeft = Math.ceil((this.coolDownUntil - Date.now()) / 60000);
            logger.warn(`❄️ Scraper is cooling down. Resuming in ${minutesLeft} minutes.`);
            throw new BotError('Scraper cooling down', ErrorCodes.SCRAPING_ERROR);
        } else if (this.coolDownUntil) {
            logger.info('☀️ Circuit Breaker reset. Resuming scraping.');
            this.coolDownUntil = null;
            this.consecutiveCaptchaCount = 0;
        }

        return scrapingLimit(async () => {
            try {
                const result = await getPrice(url);

                // Success! Reset circuit breaker
                if (this.consecutiveCaptchaCount > 0) {
                    this.consecutiveCaptchaCount = 0;
                    logger.info('✅ Successful scrape. Resetting Captcha counter.');
                }

                return result;
            } catch (error) {
                this.handleScrapingError(error);
                throw error;
            }
        });
    }

    handleScrapingError(error) {
        if (error.message.includes('Captcha')) {
            this.consecutiveCaptchaCount++;
            logger.warn(`⚠️ Captcha detected! Count: ${this.consecutiveCaptchaCount}/5`);

            if (this.consecutiveCaptchaCount >= 5) {
                this.coolDownUntil = Date.now() + (60 * 60 * 1000); // 60 minutes
                logger.error('🚨 HIGH DETECTION RATE! Circuit Breaker tripped. Pausing all scraping for 60 minutes.');
            }
        }
    }
}

// Export singleton instance
export const scraperService = new ScraperService();
