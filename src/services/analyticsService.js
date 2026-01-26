import Product from '../models/Product.js';
import { calculateVolatility, predictPriceTrend } from '../utils/priceUtils.js';
import { aiService } from './aiService.js';
import { logger } from '../utils/logger.js';

class AnalyticsService {
    /**
     * Get price forecast for the next 7 days (AI Optimized)
     * @param {string} asin 
     */
    static async getPriceForecast(asin) {
        const product = await Product.findOne({ asin });
        if (!product || !product.priceHistory || product.priceHistory.length < 2) {
            return { forecast: [], trend: 'STABLE', confidence: 0 };
        }
        const history = product.priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 1. Try AI Forecast first
        try {
            const aiPrompt = `
                Analyze the price history for: "${product.name}"
                History (Date: Price):
                ${history.slice(-10).map(h => `${new Date(h.date).toLocaleDateString()}: ${h.price}`).join('\n')}
                
                Current Price: ${product.currentPrice}

                Predict the price for the next 7 days considering:
                1. Market volatility.
                2. If the current price is a sudden drop (likely to rebound).
                3. If it's stable.

                Return strictly JSON:
                {
                  "forecast": [
                    { "day": 1, "price": <number> },
                    ...
                    { "day": 7, "price": <number> }
                  ],
                  "trend": "RISE" | "FALL" | "STABLE",
                  "confidence": <0.0 - 1.0>
                }
            `;

            const aiResult = await aiService.ask({
                systemPrompt: 'You are a financial analyst specializing in e-commerce pricing.',
                userPrompt: aiPrompt,
                model: 'sonar',
                jsonMode: true
            });

            if (aiResult && aiResult.forecast && Array.isArray(aiResult.forecast)) {
                // Map AI relative days to actual dates
                const forecast = aiResult.forecast.map(f => {
                    const d = new Date();
                    d.setDate(d.getDate() + f.day);
                    return { date: d, price: f.price };
                });
                return { forecast, trend: aiResult.trend, confidence: aiResult.confidence };
            }

        } catch (error) {
            logger.warn(`AI Forecast failed for ${asin}, falling back to linear regression: ${error.message}`);
        }

        // 2. Fallback to Linear Prediction
        const { trend, confidence, slope } = predictPriceTrend(history);
        const forecast = [];
        const lastEntry = history[history.length - 1];
        const lastPrice = lastEntry.price;
        const lastDate = new Date(lastEntry.date);
        const effectiveSlope = confidence > 0.3 ? slope : 0;

        for (let i = 1; i <= 7; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + i);
            let predictedPrice = lastPrice + (effectiveSlope * i);
            predictedPrice = Math.max(0, Math.round(predictedPrice * 100) / 100);
            forecast.push({ date: nextDate, price: predictedPrice });
        }

        return { forecast, trend, confidence };
    }

    /**
     * Get volatility score and details
     * @param {string} asin 
     */
    static async getVolatility(asin) {
        const product = await Product.findOne({ asin });
        if (!product) return { score: 0, label: 'Unknown' };

        const { score } = calculateVolatility(product.priceHistory);

        let label = 'Stable';
        if (score >= 8) label = 'High Volatility';
        else if (score >= 4) label = 'Moderate Volatility';
        else if (score >= 1) label = 'Low Volatility';

        return { score, label };
    }

    /**
     * Analyze best day of week to buy
     * @param {string} asin 
     */
    static async getBestDayToBuy(asin) {
        const product = await Product.findOne({ asin });
        if (!product || !product.priceHistory) return null;

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayStats = {};

        product.priceHistory.forEach(entry => {
            const day = new Date(entry.date).getDay();
            if (!dayStats[day]) dayStats[day] = { sum: 0, count: 0, min: Infinity };

            dayStats[day].sum += entry.price;
            dayStats[day].count++;
            dayStats[day].min = Math.min(dayStats[day].min, entry.price);
        });

        let bestDay = null;
        let lowestAvg = Infinity;

        Object.keys(dayStats).forEach(day => {
            const avg = dayStats[day].sum / dayStats[day].count;
            if (avg < lowestAvg) {
                lowestAvg = avg;
                bestDay = parseInt(day);
            }
        });

        if (bestDay === null) return null;

        return {
            dayName: days[bestDay],
            dayIndex: bestDay,
            averagePrice: lowestAvg,
            minPrice: dayStats[bestDay].min
        };
    }

    /**
     * Get stock history
     * @param {string} asin 
     */
    static async getStockHistory(asin) {
        const product = await Product.findOne({ asin });
        if (!product || !product.stockHistory) return [];
        return product.stockHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
}

export default AnalyticsService;
