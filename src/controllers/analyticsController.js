import AnalyticsService from '../services/analyticsService.js';

export const getForecast = async (req, res) => {
    try {
        const { asin } = req.params;
        const data = await AnalyticsService.getPriceForecast(asin);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getVolatility = async (req, res) => {
    try {
        const { asin } = req.params;
        const data = await AnalyticsService.getVolatility(asin);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getBestDay = async (req, res) => {
    try {
        const { asin } = req.params;
        const data = await AnalyticsService.getBestDayToBuy(asin);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getStockHistory = async (req, res) => {
    try {
        const { asin } = req.params;
        const data = await AnalyticsService.getStockHistory(asin);
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
