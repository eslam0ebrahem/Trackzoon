import Product from '../models/Product.js';
import { calculateVolatility, predictPriceTrend, calculatePriceStats, calculateDropProbability, calculateSeasonalityHint } from '../utils/priceUtils.js';
import { aiService } from './aiService.js';
import { logger } from '../utils/logger.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const toNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

const normalizeHistory = (priceHistory = []) => {
    return [...(priceHistory || [])]
        .filter((entry) => entry && Number.isFinite(Number(entry.price)))
        .map((entry) => ({
            price: Number(entry.price),
            date: new Date(entry.date)
        }))
        .filter((entry) => !Number.isNaN(entry.date.getTime()))
        .sort((a, b) => a.date.getTime() - b.date.getTime());
};

const computeConfidence = (history, trend, stats30d) => {
    const historyStrength = clamp(history.length / 30, 0, 1);
    const trendStrength = clamp(toNumber(trend?.confidence, 0), 0, 1);
    const densityStrength = clamp((stats30d?.count || 0) / 20, 0, 1);
    const combined = (historyStrength * 0.45) + (trendStrength * 0.35) + (densityStrength * 0.2);
    return Number(clamp(combined, 0.1, 0.98).toFixed(2));
};

const computeExpectedBestPrice7d = ({
    currentPrice,
    stats30d,
    trend,
    volatilityScore,
    dropProbability
}) => {
    if (!stats30d || currentPrice <= 0) return currentPrice;

    const range = Math.max(0, (stats30d.max || currentPrice) - (stats30d.min || currentPrice));
    const slope = Math.abs(toNumber(trend?.slope, 0));
    const trendDrivenDrop = trend?.trend === 'DOWN'
        ? slope * (2 + (toNumber(trend?.confidence, 0.2) * 5))
        : 0;

    const volatilitySwing = (clamp(volatilityScore, 0, 10) / 10) * (range * 0.25);
    const probabilityComponent = (clamp(dropProbability, 0, 100) / 100) * (range * 0.3);

    const rawBest = currentPrice - trendDrivenDrop - volatilitySwing - probabilityComponent;
    const floor = Math.max(0, (stats30d.min || 0) * 0.85);
    const best = clamp(rawBest, floor, currentPrice);
    return Number(best.toFixed(2));
};

const buildReasoning = ({
    recommendation,
    dropProbability7d,
    expectedSavingsPercent,
    trend,
    volatility,
    thresholdPrice,
    currentPrice,
    seasonality
}) => {
    const reasons = [];

    if (recommendation === 'buy_now') {
        reasons.push('Current pricing is already near your recent lows.');
    }
    if (recommendation === 'wait') {
        reasons.push('Model sees meaningful short-term downside potential.');
    }
    if (thresholdPrice && currentPrice <= thresholdPrice) {
        reasons.push('Price is below your configured target.');
    }
    if (dropProbability7d >= 65) {
        reasons.push('High probability of additional drop in the next 7 days.');
    } else if (dropProbability7d <= 35) {
        reasons.push('Low probability of a near-term drop from current level.');
    }
    if (expectedSavingsPercent >= 4) {
        reasons.push(`Estimated additional savings could reach ${expectedSavingsPercent.toFixed(1)}%.`);
    }
    if (trend?.trend === 'UP') {
        reasons.push('Short-term trend is rising, reducing wait attractiveness.');
    } else if (trend?.trend === 'DOWN') {
        reasons.push('Short-term trend is falling, which favors waiting.');
    }
    if (volatility?.score >= 7) {
        reasons.push('High volatility adds timing risk.');
    }
    if (seasonality && seasonality.nextLowInMonths <= 2) {
        reasons.push(`Seasonality suggests lower prices around ${seasonality.monthName}.`);
    }

    return reasons.slice(0, 4);
};

const getRiskLevel = (volatilityScore, trend, confidence) => {
    if (volatilityScore >= 8) return 'high';
    if (trend?.trend === 'UP' && confidence >= 0.7) return 'high';
    if (volatilityScore >= 5) return 'medium';
    return 'low';
};

const getUrgency = ({ recommendation, trend, dropProbability7d, thresholdPrice, currentPrice }) => {
    if (recommendation === 'buy_now' && (trend?.trend === 'UP' || (thresholdPrice && currentPrice <= thresholdPrice))) {
        return 'high';
    }
    if (recommendation === 'wait' && dropProbability7d >= 65) {
        return 'low';
    }
    return 'medium';
};

const getWaitDays = ({ recommendation, dropProbability7d, expectedSavingsPercent }) => {
    if (recommendation !== 'wait') return 0;
    if (dropProbability7d >= 75 || expectedSavingsPercent >= 6) return 7;
    if (dropProbability7d >= 60 || expectedSavingsPercent >= 4) return 5;
    if (dropProbability7d >= 45 || expectedSavingsPercent >= 2) return 3;
    return 1;
};

const toDisplayTrend = (trend) => {
    if (trend === 'UP') return 'RISE';
    if (trend === 'DOWN') return 'DROP';
    return 'STABLE';
};

const buildDealIntelligence = (product) => {
    const history = normalizeHistory(product.priceHistory || []);
    const currentPrice = toNumber(product.currentPrice, 0);
    const stats30d = calculatePriceStats(history, 30) || {
        average: toNumber(product?.stats?.avg, currentPrice),
        min: toNumber(product?.stats?.min, currentPrice),
        max: toNumber(product?.stats?.max, currentPrice),
        count: history.length
    };
    const trend = predictPriceTrend(history);
    const volatility = calculateVolatility(history);
    const dropProbability7d = calculateDropProbability(currentPrice, stats30d, trend);
    const expectedBestPrice7d = computeExpectedBestPrice7d({
        currentPrice,
        stats30d,
        trend,
        volatilityScore: volatility.score,
        dropProbability: dropProbability7d
    });
    const expectedSavingsAmount = Math.max(0, currentPrice - expectedBestPrice7d);
    const expectedSavingsPercent = currentPrice > 0
        ? Number(((expectedSavingsAmount / currentPrice) * 100).toFixed(2))
        : 0;
    const confidence = computeConfidence(history, trend, stats30d);
    const seasonality = calculateSeasonalityHint(history);
    const thresholdPrice = product.thresholdPrice ? Number(product.thresholdPrice) : null;
    const smartScore = toNumber(product.smartScore, 50);

    const shouldWait = !product.isOutOfStock && dropProbability7d >= 55 && expectedSavingsPercent >= 2;
    const strongBuy = !product.isOutOfStock && (
        smartScore >= 75 ||
        (thresholdPrice && currentPrice <= thresholdPrice) ||
        (dropProbability7d <= 30 && expectedSavingsPercent < 2)
    );

    let recommendation = 'monitor';
    if (product.isOutOfStock) recommendation = 'monitor';
    else if (strongBuy) recommendation = 'buy_now';
    else if (shouldWait) recommendation = 'wait';

    const waitDays = getWaitDays({ recommendation, dropProbability7d, expectedSavingsPercent });
    const riskLevel = getRiskLevel(volatility.score, trend, confidence);
    const urgency = getUrgency({
        recommendation,
        trend,
        dropProbability7d,
        thresholdPrice,
        currentPrice
    });

    const buyNowScore = clamp(
        Math.round(
            (smartScore * 0.45) +
            ((100 - dropProbability7d) * 0.3) +
            ((10 - clamp(volatility.score, 0, 10)) * 2) +
            (thresholdPrice && currentPrice <= thresholdPrice ? 12 : 0)
        ),
        0,
        100
    );

    const waitScore = clamp(
        Math.round(
            (dropProbability7d * 0.55) +
            (expectedSavingsPercent * 6) +
            (clamp(volatility.score, 0, 10) * 2)
        ),
        0,
        100
    );

    const signals = {
        trend: toDisplayTrend(trend.trend),
        trendConfidence: Number(toNumber(trend.confidence, 0).toFixed(2)),
        volatilityScore: Number(toNumber(volatility.score, 0).toFixed(2)),
        thirtyDayLow: Number(toNumber(stats30d.min, currentPrice).toFixed(2)),
        thirtyDayAverage: Number(toNumber(stats30d.average, currentPrice).toFixed(2)),
        thirtyDayHigh: Number(toNumber(stats30d.max, currentPrice).toFixed(2)),
        smartScore: Number(toNumber(smartScore, 0).toFixed(0)),
        targetHit: Boolean(thresholdPrice && currentPrice <= thresholdPrice),
        seasonality
    };

    const reasoning = buildReasoning({
        recommendation,
        dropProbability7d,
        expectedSavingsPercent,
        trend,
        volatility,
        thresholdPrice,
        currentPrice,
        seasonality
    });

    const narrative = reasoning.length
        ? reasoning.join(' ')
        : 'Price signal is mixed; monitor upcoming moves before making a decision.';

    return {
        modelVersion: 'deal-intelligence-v1',
        generatedAt: new Date(),
        recommendation,
        urgency,
        confidence,
        riskLevel,
        buyNowScore,
        waitScore,
        dropProbability7d,
        expectedBestPrice7d,
        expectedSavingsAmount: Number(expectedSavingsAmount.toFixed(2)),
        expectedSavingsPercent,
        suggestedWaitDays: waitDays,
        signals,
        reasoning,
        narrative
    };
};

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

    /**
     * Get best recent drops across all products
     * @param {Object} options
     * @param {number} options.limit
     * @param {number} options.hours
     */
    static async getBestDrops({ limit = 5, hours = 24 } = {}) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);

        const products = await Product.find({
            isOutOfStock: false,
            lastDropDate: { $gte: since },
            discountPercentage: { $lt: 0 }
        })
            .sort({ discountPercentage: 1 })
            .limit(limit)
            .select('name asin url currentPrice discountPercentage dealLabel smartScore lastDropDate imageUrl');

        return products.map(p => ({
            asin: p.asin,
            name: p.name,
            url: p.url,
            currentPrice: p.currentPrice,
            discountPercent: Math.abs(p.discountPercentage || 0),
            dealLabel: p.dealLabel,
            smartScore: p.smartScore,
            lastDropDate: p.lastDropDate,
            imageUrl: p.imageUrl
        }));
    }

    /**
     * Get trend overview (drop/rise/stable) across products
     * Uses recent AI prediction if available, otherwise falls back to last price change.
     */
    static async getTrendOverview({ days = 7 } = {}) {
        const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const results = await Product.aggregate([
            {
                $project: {
                    aiTrend: '$aiPrediction.trend',
                    aiUpdated: '$aiPrediction.lastUpdated',
                    lastChange: '$lastPriceChange.percent'
                }
            },
            {
                $addFields: {
                    trend: {
                        $cond: [
                            { $and: [{ $ne: ['$aiTrend', null] }, { $gte: ['$aiUpdated', cutoff] }] },
                            '$aiTrend',
                            {
                                $cond: [
                                    { $lt: ['$lastChange', 0] }, 'DROP',
                                    { $cond: [{ $gt: ['$lastChange', 0] }, 'RISE', 'STABLE'] }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$trend',
                    count: { $sum: 1 }
                }
            }
        ]);

        const summary = {
            DROP: 0,
            RISE: 0,
            STABLE: 0,
            UNKNOWN: 0
        };

        results.forEach(r => {
            summary[r._id || 'UNKNOWN'] = r.count;
        });

        const total = Object.values(summary).reduce((acc, v) => acc + v, 0);
        const percentages = Object.fromEntries(
            Object.entries(summary).map(([key, value]) => [
                key,
                total > 0 ? Math.round((value / total) * 100) : 0
            ])
        );

        return { total, counts: summary, percentages };
    }

    /**
     * Get top categories with counts and averages
     */
    static async getTopCategories({ limit = 5, sort = 'count' } = {}) {
        const pipeline = [
            { $match: { category: { $ne: null } } },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgScore: { $avg: '$smartScore' },
                    avgDiscount: { $avg: { $abs: '$discountPercentage' } }
                }
            }
        ];

        let sortStage = { $sort: { count: -1 } };
        if (sort === 'score') sortStage = { $sort: { avgScore: -1 } };
        if (sort === 'discount') sortStage = { $sort: { avgDiscount: -1 } };

        pipeline.push(sortStage, { $limit: limit });

        const results = await Product.aggregate(pipeline);
        return results.map(r => ({
            category: r._id,
            count: r.count,
            avgScore: Math.round(r.avgScore || 0),
            avgDiscount: Number((r.avgDiscount || 0).toFixed(1))
        }));
    }

    /**
     * Get AI deal intelligence for a single product
     * @param {string} asin
     * @param {Object} options
     * @param {boolean} options.includeNarrative - Optionally request LLM-enhanced narrative
     */
    static async getDealIntelligence(asin, { includeNarrative = false } = {}) {
        const product = await Product.findOne({ asin })
            .select('asin name url imageUrl currentPrice isOutOfStock thresholdPrice smartScore volatilityScore stats priceHistory dealLabel')
            .lean();

        if (!product) {
            const error = new Error('Product not found');
            error.statusCode = 404;
            throw error;
        }

        const intelligence = buildDealIntelligence(product);
        let llmNarrative = null;

        if (includeNarrative && process.env.GROQ_API_KEY) {
            try {
                const aiResult = await aiService.ask({
                    systemPrompt: 'You are a concise e-commerce deal intelligence analyst. Respond with only one short paragraph.',
                    userPrompt: `
Product: ${product.name}
Current price: ${product.currentPrice}
Recommendation: ${intelligence.recommendation}
Drop probability (7d): ${intelligence.dropProbability7d}%
Expected best price (7d): ${intelligence.expectedBestPrice7d}
Risk: ${intelligence.riskLevel}
Reasoning: ${intelligence.reasoning.join(' | ')}

Give one practical buying recommendation for a value-focused user.
`,
                    model: 'llama-3.1-8b-instant',
                    temperature: 0.2,
                    jsonMode: false,
                    tokenEstimate: 400
                });
                llmNarrative = typeof aiResult === 'string' ? aiResult.trim() : null;
            } catch (error) {
                logger.warn(`Deal intelligence narrative AI failed for ${asin}: ${error.message}`);
            }
        }

        return {
            asin: product.asin,
            name: product.name,
            url: product.url,
            imageUrl: product.imageUrl || null,
            currentPrice: product.currentPrice,
            isOutOfStock: !!product.isOutOfStock,
            intelligence: {
                ...intelligence,
                llmNarrative
            }
        };
    }

    /**
     * Get top AI-ranked deal opportunities across products
     * @param {Object} options
     * @param {number} options.limit
     */
    static async getDealOpportunities({ limit = 8 } = {}) {
        const safeLimit = clamp(Number(limit) || 8, 1, 30);
        const sampleSize = clamp(safeLimit * 20, 50, 300);

        const products = await Product.find({
            isArchived: { $ne: true }
        })
            .sort({ smartScore: -1, lastChecked: -1 })
            .limit(sampleSize)
            .select('asin name url imageUrl currentPrice isOutOfStock thresholdPrice smartScore volatilityScore stats priceHistory dealLabel')
            .lean();

        const scored = products
            .map((product) => {
                const intelligence = buildDealIntelligence(product);
                const priorityScore = clamp(
                    Math.round(
                        (intelligence.buyNowScore * 0.55) +
                        (Math.max(0, intelligence.expectedSavingsPercent) * 4) +
                        (intelligence.confidence * 20) +
                        (product.isOutOfStock ? -25 : 0)
                    ),
                    0,
                    100
                );

                return {
                    asin: product.asin,
                    name: product.name,
                    url: product.url,
                    imageUrl: product.imageUrl || null,
                    currentPrice: product.currentPrice,
                    isOutOfStock: !!product.isOutOfStock,
                    dealLabel: product.dealLabel || 'fair_price',
                    priorityScore,
                    intelligence
                };
            })
            .sort((a, b) => {
                if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
                return (b.intelligence.expectedSavingsPercent || 0) - (a.intelligence.expectedSavingsPercent || 0);
            })
            .slice(0, safeLimit);

        const recommendationCounts = scored.reduce((acc, item) => {
            const key = item.intelligence.recommendation || 'monitor';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, { buy_now: 0, wait: 0, monitor: 0 });

        return {
            modelVersion: 'deal-intelligence-v1',
            generatedAt: new Date(),
            analyzed: products.length,
            recommendationCounts,
            items: scored
        };
    }
}

export default AnalyticsService;
