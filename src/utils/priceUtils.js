/**
 * Calculate price statistics from price history
 * @param {Array} priceHistory - Array of price history objects { price, date }
 * @param {number} days - Number of days to look back (default: 30)
 * @returns {Object|null} - Statistics object { average, min, max, count } or null if no history
 */
export const calculatePriceStats = (priceHistory, days = 30) => {
    if (!priceHistory || priceHistory.length === 0) return null;

    const now = new Date();
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Filter prices within the time window
    const relevantPrices = priceHistory.filter(entry => {
        const entryDate = new Date(entry.date);
        return entryDate >= cutoffDate;
    });

    if (relevantPrices.length === 0) {
        // If no recent history, fall back to all history or return null
        // For safety, let's use the last 5 entries if available, otherwise all
        const fallbackPrices = priceHistory.slice(-5);
        if (fallbackPrices.length === 0) return null;

        const prices = fallbackPrices.map(p => p.price);
        const sum = prices.reduce((a, b) => a + b, 0);

        return {
            average: sum / prices.length,
            min: Math.min(...prices),
            max: Math.max(...prices),
            count: prices.length
        };
    }

    const prices = relevantPrices.map(p => p.price);
    const sum = prices.reduce((a, b) => a + b, 0);
    const average = sum / prices.length;

    // Calculate Standard Deviation
    const squareDiffs = prices.map(price => {
        const diff = price - average;
        return diff * diff;
    });
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(avgSquareDiff);

    return {
        average,
        min: Math.min(...prices),
        max: Math.max(...prices),
        count: prices.length,
        stdDev
    };
};

/**
 * Calculate volatility score and recommended check interval
 * @param {Array} priceHistory - Array of price history objects
 * @returns {Object} - { score, interval }
 */
export const calculateVolatility = (priceHistory) => {
    if (!priceHistory || priceHistory.length < 2) {
        return { score: 0, interval: 30 }; // Default to frequent checks for new products
    }

    const now = new Date();
    const daysToAnalyze = 14;
    const cutoffDate = new Date(now.getTime() - daysToAnalyze * 24 * 60 * 60 * 1000);

    // Get recent history sorted by date
    const recentHistory = priceHistory
        .filter(entry => new Date(entry.date) >= cutoffDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (recentHistory.length < 2) {
        return { score: 0, interval: 60 }; // Low data, check hourly
    }

    // Count price changes
    let changes = 0;
    for (let i = 1; i < recentHistory.length; i++) {
        const prevPrice = recentHistory[i - 1].price;
        const currPrice = recentHistory[i].price;

        // Calculate percentage difference
        // If previous price is 0, any change is infinite, but let's just count it if current is not 0
        if (prevPrice === 0) {
            if (currPrice !== 0) changes++;
            continue;
        }

        const percentDiff = Math.abs((currPrice - prevPrice) / prevPrice) * 100;

        // Only count as a change if it's significant (> 0.5%)
        if (percentDiff > 0.5) {
            changes++;
        }
    }

    // Calculate score (0-10)
    // If it changes more than 5 times in 14 days, it's very volatile (Score 10)
    const score = Math.min((changes / 5) * 10, 10);

    // Determine interval (minutes)
    let interval;
    if (score >= 8) interval = 60;       // Very Volatile: Check every 1 hour
    else if (score >= 4) interval = 180; // Moderately Volatile: Check every 3 hours
    else if (score >= 1) interval = 360; // Low Volatility: Check every 6 hours
    else interval = 720;                 // Stable: Check every 12 hours

    return { score, interval };
};

/**
 * Apply random jitter to an interval to avoid predictable patterns
 * @param {number} intervalMinutes - Base interval in minutes
 * @param {number} jitterPercent - Max percentage of jitter (default 0.2 = 20%)
 * @returns {number} - Interval with jitter applied
 */
export const applyJitter = (intervalMinutes, jitterPercent = 0.2) => {
    // Random factor between -jitterPercent and +jitterPercent
    const factor = (Math.random() * 2 - 1) * jitterPercent;
    return Math.round(intervalMinutes * (1 + factor));
};

/**
 * Predict price trend based on recent history
 * @param {Array} priceHistory - Array of price history objects
 * @returns {Object} - { trend: 'UP'|'DOWN'|'STABLE', confidence: number }
 */
export const predictPriceTrend = (priceHistory) => {
    if (!priceHistory || priceHistory.length < 3) {
        return { trend: 'STABLE', confidence: 0 };
    }

    // Use last 5 entries or all if less than 5
    const recent = priceHistory.slice(-5);

    // Simple linear regression slope
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    const n = recent.length;

    recent.forEach((entry, index) => {
        sumX += index;
        sumY += entry.price;
        sumXY += index * entry.price;
        sumXX += index * index;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

    // Determine trend
    let trend = 'STABLE';
    if (slope < -0.5) trend = 'DOWN';
    else if (slope > 0.5) trend = 'UP';

    // Calculate confidence based on consistency (R-squared would be better but this is simple)
    // For now, just use sample size as proxy for confidence
    const confidence = Math.min(n / 5, 1.0);

    return { trend, confidence, slope };
};

/**
 * Calculate a score for how good a deal is (0-100)
 * @param {number} currentPrice 
 * @param {Object} stats30d - { min, average, max }
 * @returns {number} Score from 0 to 100
 */
export const calculateDealScore = (currentPrice, stats30d, volatilityScore = 0, isOutOfStock = false, trend = null) => {
    if (isOutOfStock) return 0;
    if (!stats30d) return 50; // Neutral score if no stats

    // 1. Discount from Average (max 50 points)
    const discountFromAvg = ((stats30d.average - currentPrice) / stats30d.average) * 100;
    const avgScore = Math.max(0, Math.min(discountFromAvg * 2, 50));

    // 2. Proximity to Low (max 40 points) - INCREASED WEIGHT
    const range = stats30d.average - stats30d.min;
    let lowScore = 0;

    if (range > 0) {
        const distFromLow = currentPrice - stats30d.min;
        if (distFromLow <= 0) {
            lowScore = 40; // Best price!
        } else {
            const pctOfRange = 1 - (distFromLow / range);
            lowScore = Math.max(0, pctOfRange * 40);
        }
    }

    // 2.5. Z-Score Bonus (Statistical Significance)
    // If we have standard deviation, we can see how "rare" this low price is
    let zScoreBonus = 0;
    if (stats30d.stdDev && stats30d.stdDev > 0) {
        const zScore = (stats30d.average - currentPrice) / stats30d.stdDev;
        if (zScore >= 2) zScoreBonus = 20;      // Extremely good deal (2 sigma)
        else if (zScore >= 1) zScoreBonus = 10; // Good deal (1 sigma)
    }

    // 2.6. Trend Bonus
    let trendBonus = 0;
    if (trend && trend.trend === 'DOWN') {
        trendBonus = 5;
    }

    // 3. Volatility Penalty (max -10 points) - REDUCED PENALTY
    // High volatility means price jumps around a lot, so a "deal" might not be special
    const volatilityPenalty = Math.min(volatilityScore, 10);

    // 4. Stability Bonus (max 10 points)
    // If low volatility, this price drop is more significant
    const stabilityBonus = volatilityScore < 3 ? 10 : 0;

    let totalScore = avgScore + lowScore + zScoreBonus - volatilityPenalty + stabilityBonus + trendBonus;

    return Math.max(0, Math.min(Math.round(totalScore), 100));
};

/**
 * Calculate probability of further price drop (0-100%)
 * @param {number} currentPrice
 * @param {Object} stats30d
 * @param {Object} trend
 * @returns {number} Probability percentage
 */
export const calculateDropProbability = (currentPrice, stats30d, trend) => {
    if (!stats30d) return 50; // Unknown

    // 1. Distance from Low (If far from low, high chance to drop)
    const range = stats30d.max - stats30d.min;
    if (range === 0) return 0; // Flat line

    const distFromLow = currentPrice - stats30d.min;
    const positionInRange = distFromLow / range; // 0 = at low, 1 = at high

    let probability = positionInRange * 80; // Max 80% from position

    // 2. Trend Influence
    if (trend && trend.trend === 'DOWN') {
        probability += 20; // Trend is down, higher chance
    } else if (trend && trend.trend === 'UP') {
        probability -= 20; // Trend is up, lower chance
    }

    return Math.max(0, Math.min(Math.round(probability), 100));
};
