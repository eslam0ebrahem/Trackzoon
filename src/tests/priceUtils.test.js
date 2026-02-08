import { calculateDealScore, calculateVolatility, predictPriceTrend, calculateSeasonalityHint } from '../utils/priceUtils.js';

describe('Price Utils', () => {
    describe('calculateDealScore', () => {
        const stats30d = { min: 100, average: 200, max: 300, stdDev: 50 };

        test('should return high score for all-time low', () => {
            const score = calculateDealScore(100, stats30d);
            expect(score).toBeGreaterThan(80);
        });

        test('should return 0 if out of stock', () => {
            const score = calculateDealScore(100, stats30d, 0, true);
            expect(score).toBe(0);
        });

        test('should penalize high volatility', () => {
            const scoreStable = calculateDealScore(150, stats30d, 0);
            const scoreVolatile = calculateDealScore(150, stats30d, 10);
            expect(scoreStable).toBeGreaterThan(scoreVolatile);
        });
    });

    describe('calculateVolatility', () => {
        test('should return 0 for insufficient history', () => {
            const { score } = calculateVolatility([]);
            expect(score).toBe(0);
        });

        test('should detect high volatility', () => {
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            const history = [
                { price: 100, date: new Date(now - 5 * day) },
                { price: 200, date: new Date(now - 4 * day) },
                { price: 100, date: new Date(now - 3 * day) },
                { price: 200, date: new Date(now - 2 * day) },
                { price: 100, date: new Date(now - 1 * day) },
                { price: 200, date: new Date(now) }
            ];
            const { score } = calculateVolatility(history);
            expect(score).toBeGreaterThan(5);
        });
    });

    describe('predictPriceTrend', () => {
        test('should detect UP trend', () => {
            const history = [
                { price: 100, date: new Date('2023-01-01') },
                { price: 110, date: new Date('2023-01-02') },
                { price: 120, date: new Date('2023-01-03') }
            ];
            const { trend } = predictPriceTrend(history);
            expect(trend).toBe('UP');
        });

        test('should detect DOWN trend', () => {
            const history = [
                { price: 120, date: new Date('2023-01-01') },
                { price: 110, date: new Date('2023-01-02') },
                { price: 100, date: new Date('2023-01-03') }
            ];
            const { trend } = predictPriceTrend(history);
            expect(trend).toBe('DOWN');
        });
    });

    describe('calculateSeasonalityHint', () => {
        test('should return lowest average month', () => {
            const history = [
                { price: 120, date: new Date('2023-01-01') },
                { price: 125, date: new Date('2023-01-10') },
                { price: 118, date: new Date('2023-01-20') },
                { price: 122, date: new Date('2023-01-28') },
                { price: 90, date: new Date('2023-02-03') },
                { price: 92, date: new Date('2023-02-10') },
                { price: 88, date: new Date('2023-02-17') },
                { price: 91, date: new Date('2023-02-25') },
                { price: 140, date: new Date('2023-03-02') },
                { price: 135, date: new Date('2023-03-11') },
                { price: 138, date: new Date('2023-03-18') },
                { price: 142, date: new Date('2023-03-27') }
            ];

            const hint = calculateSeasonalityHint(history);
            expect(hint).not.toBeNull();
            expect(hint.monthName).toBe('February');
        });
    });
});
