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
