import { jest } from '@jest/globals';

// Mock dependencies
jest.unstable_mockModule('../utils/scraper/getPrice.js', () => ({
    getPrice: jest.fn()
}));
jest.unstable_mockModule('../utils/logger.js', () => ({
    logger: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const { getPrice } = await import('../utils/scraper/getPrice.js');
const { ScraperService } = await import('../services/scraperService.js');

describe('ScraperService Circuit Breaker', () => {
    let service;

    beforeEach(() => {
        service = new ScraperService();
        jest.clearAllMocks();
    });

    test('should scrape successfully and reset counter', async () => {
        getPrice.mockResolvedValue({ currentPrice: 100 });
        service.consecutiveCaptchaCount = 2;

        await service.scrapeProduct('http://example.com');

        expect(service.consecutiveCaptchaCount).toBe(0);
        expect(getPrice).toHaveBeenCalled();
    });

    test('should increment counter on Captcha error', async () => {
        getPrice.mockRejectedValue(new Error('Captcha detected'));

        try {
            await service.scrapeProduct('http://example.com');
        } catch (e) {
            // Expected
        }

        expect(service.consecutiveCaptchaCount).toBe(1);
    });

    test('should trip circuit breaker after 5 failures', async () => {
        getPrice.mockRejectedValue(new Error('Captcha detected'));

        for (let i = 0; i < 5; i++) {
            try {
                await service.scrapeProduct('http://example.com');
            } catch (e) { }
        }

        expect(service.consecutiveCaptchaCount).toBe(5);
        expect(service.coolDownUntil).not.toBeNull();
    });

    test('should block requests when cooling down', async () => {
        service.coolDownUntil = Date.now() + 100000; // Future

        await expect(service.scrapeProduct('http://example.com'))
            .rejects.toThrow('Scraper cooling down');

        expect(getPrice).not.toHaveBeenCalled();
    });
});
