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
        this.totalScrapes = 0;
        this.failedScrapes = 0;
    }

    /**
     * Get current service health and status
     */
    getServiceStatus() {
        const isCoolingDown = this.coolDownUntil && Date.now() < this.coolDownUntil;
        return {
            status: isCoolingDown ? 'PAUSED' : 'ACTIVE',
            coolDownRemaining: isCoolingDown ? Math.ceil((this.coolDownUntil - Date.now()) / 60000) : 0,
            consecutiveFailures: this.consecutiveCaptchaCount,
            totalScrapes: this.totalScrapes,
            failedScrapes: this.failedScrapes,
            activeRequests: scrapingLimit.activeCount,
            pendingRequests: scrapingLimit.pendingCount
        };
    }

    /**
     * Manually reset the circuit breaker
     */
    resetCircuitBreaker() {
        this.coolDownUntil = null;
        this.consecutiveCaptchaCount = 0;
        logger.info('🔄 Circuit Breaker manually reset.');
    }

    async scrapeProduct(url) {
        // Circuit Breaker Check
        if (this.coolDownUntil && Date.now() < this.coolDownUntil) {
            const minutesLeft = Math.ceil((this.coolDownUntil - Date.now()) / 60000);
            logger.warn(`❄️ Scraper is cooling down. Resuming in ${minutesLeft} minutes.`);
            throw new BotError('Scraper cooling down', ErrorCodes.SCRAPING_ERROR);
        } else if (this.coolDownUntil) {
            logger.info('☀️ Circuit Breaker cooldown finished. Resuming scraping.');
            this.coolDownUntil = null;
            this.consecutiveCaptchaCount = 0;
        }

        return scrapingLimit(async () => {
            this.totalScrapes++;
            try {
                const result = await getPrice(url);

                // Success! Reset circuit breaker if we had some failures but didn't trip
                if (this.consecutiveCaptchaCount > 0) {
                    this.consecutiveCaptchaCount = 0;
                    logger.info('✅ Successful scrape. Resetting failure counter.');
                }

                return result;
            } catch (error) {
                this.failedScrapes++;
                this.handleScrapingError(error);
                throw error;
            }
        });
    }

    handleScrapingError(error) {
        // We only care about detection/blocking errors for the circuit breaker
        const isBlockingError = error.message.includes('Captcha') ||
            error.message.includes('Robot Check') ||
            (error.response && error.response.status === 403);

        if (isBlockingError) {
            this.consecutiveCaptchaCount++;
            logger.warn(`⚠️ Blocking detected! Count: ${this.consecutiveCaptchaCount}/5`);

            if (this.consecutiveCaptchaCount >= 5) {
                // Exponential backoff could be implemented here, but fixed 60m is safer for now
                this.coolDownUntil = Date.now() + (60 * 60 * 1000); // 60 minutes
                logger.error('🚨 HIGH DETECTION RATE! Circuit Breaker tripped. Pausing all scraping for 60 minutes.');
            }
        }
    }
}

// Export singleton instance
export const scraperService = new ScraperService();
