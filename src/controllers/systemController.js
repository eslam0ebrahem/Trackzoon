import { SystemService } from '../services/systemService.js';

export const getHealth = async (req, res) => {
    try {
        const health = await SystemService.getHealth({ includeScraper: true });
        res.json(health);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getDbStats = async (req, res) => {
    try {
        const stats = await SystemService.getDbStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getQueueStatus = async (req, res) => {
    res.json(SystemService.getQueueStatus());
};

export const getMetricsHistory = async (req, res) => {
    try {
        const { type, limit = 24 } = req.query; // Default last 24 entries (e.g. hours)
        const metrics = await SystemService.getMetricsHistory(type, limit);
        res.json(metrics);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
