import SystemMetric from '../models/SystemMetric.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import mongoose from 'mongoose';

export const getHealth = async (req, res) => {
    try {
        const uptime = process.uptime();
        const memory = process.memoryUsage();

        // Get latest scraper stats
        const lastScrape = await SystemMetric.findOne({ type: 'scraper' }).sort({ timestamp: -1 });

        res.json({
            status: 'ok',
            uptime,
            timestamp: new Date(),
            memory: {
                heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
                rss: Math.round(memory.rss / 1024 / 1024)
            },
            scraper: lastScrape ? lastScrape.data : null
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getDbStats = async (req, res) => {
    try {
        const dbStats = await mongoose.connection.db.stats();
        const productCount = await Product.countDocuments();
        const userCount = await User.countDocuments();
        const metricCount = await SystemMetric.countDocuments();

        res.json({
            storageSize: (dbStats.storageSize / 1024 / 1024).toFixed(2) + ' MB',
            objects: dbStats.objects,
            collections: {
                products: productCount,
                users: userCount,
                metrics: metricCount
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getQueueStatus = async (req, res) => {
    // Mock queue status since we use in-memory p-limit
    // In a real Redis queue system, we would query Redis
    res.json({
        active: 0,
        pending: 0,
        completed: 0,
        failed: 0
    });
};

export const getMetricsHistory = async (req, res) => {
    try {
        const { type, limit = 24 } = req.query; // Default last 24 entries (e.g. hours)
        const metrics = await SystemMetric.find({ type })
            .sort({ timestamp: -1 })
            .limit(parseInt(limit));

        res.json(metrics.reverse());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
