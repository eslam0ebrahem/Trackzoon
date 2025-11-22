import Product from '../models/Product.js';
import { calculateVolatility, predictPriceTrend } from '../utils/priceUtils.js';

class AnalyticsService {
    /**
     * Get price forecast for the next 7 days
     * @param {string} asin 
     */
    static async getPriceForecast(asin) {
        const product = await Product.findOne({ asin });
        if (!product || !product.priceHistory || product.priceHistory.length < 2) {
            return { forecast: [], trend: 'STABLE', confidence: 0 };
        }

        const history = product.priceHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
        const { trend, confidence, slope } = predictPriceTrend(history);

        // Generate next 7 days points
        const forecast = [];
        const lastEntry = history[history.length - 1];
        const lastPrice = lastEntry.price;
        const lastDate = new Date(lastEntry.date);

        // If confidence is too low, predict flat line
        const effectiveSlope = confidence > 0.3 ? slope : 0;

        for (let i = 1; i <= 7; i++) {
            const nextDate = new Date(lastDate);
            nextDate.setDate(lastDate.getDate() + i);

            // Simple linear projection: y = mx + c
            // We assume each array index in history was 1 unit of time roughly? 
            // predictPriceTrend used index as X. 
            // So we just add slope * i to the last price? 
            // Wait, predictPriceTrend calculated slope based on index (0, 1, 2...).
            // So the slope is "price change per history entry".
            // This is rough because history entries might not be evenly spaced.
            // But for a simple estimation it's okay.

            let predictedPrice = lastPrice + (effectiveSlope * i);
            predictedPrice = Math.max(0, Math.round(predictedPrice * 100) / 100); // Ensure positive

            forecast.push({
                date: nextDate,
                price: predictedPrice
            });
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
