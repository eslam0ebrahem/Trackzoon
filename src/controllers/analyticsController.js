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

export const getBestDrops = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 5;
        const hours = parseInt(req.query.hours, 10) || 24;
        const data = await AnalyticsService.getBestDrops({ limit, hours });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTrendOverview = async (req, res) => {
    try {
        const days = parseInt(req.query.days, 10) || 7;
        const data = await AnalyticsService.getTrendOverview({ days });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTopCategories = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit, 10) || 5;
        const sort = req.query.sort || 'count';
        const data = await AnalyticsService.getTopCategories({ limit, sort });
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
