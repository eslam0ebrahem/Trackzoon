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

    return {
        average: sum / prices.length,
        min: Math.min(...prices),
        max: Math.max(...prices),
        count: prices.length
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
        if (recentHistory[i].price !== recentHistory[i - 1].price) {
            changes++;
        }
    }

    // Calculate score (0-10)
    // If it changes more than 5 times in 14 days, it's very volatile (Score 10)
    const score = Math.min((changes / 5) * 10, 10);

    // Determine interval (minutes)
    let interval;
    if (score >= 8) interval = 30;      // Very Volatile: Check every 30 mins
    else if (score >= 4) interval = 60; // Moderately Volatile: Check every hour
    else if (score >= 1) interval = 120; // Low Volatility: Check every 2 hours
    else interval = 240;                // Stable: Check every 4 hours

    return { score, interval };
};
