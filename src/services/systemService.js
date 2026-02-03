import mongoose from 'mongoose';
import SystemMetric from '../models/SystemMetric.js';
import Product from '../models/Product.js';
import User from '../models/User.js';

export class SystemService {
  static async getHealth({ includeScraper = false } = {}) {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    const health = {
      status: 'ok',
      uptime,
      timestamp: new Date(),
      memory: {
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
        rss: Math.round(memory.rss / 1024 / 1024)
      }
    };

    if (includeScraper) {
      const lastScrape = await SystemMetric.findOne({ type: 'scraper' })
        .sort({ timestamp: -1 })
        .lean();

      health.scraper = lastScrape ? lastScrape.data : null;
    }

    return health;
  }

  static async getDbStats() {
    const dbStats = await mongoose.connection.db.stats();
    const [productCount, userCount, metricCount] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      SystemMetric.countDocuments()
    ]);

    return {
      storageSize: `${(dbStats.storageSize / 1024 / 1024).toFixed(2)} MB`,
      objects: dbStats.objects,
      collections: {
        products: productCount,
        users: userCount,
        metrics: metricCount
      }
    };
  }

  static getQueueStatus() {
    return {
      active: 0,
      pending: 0,
      completed: 0,
      failed: 0
    };
  }

  static async getMetricsHistory(type, limit = 24) {
    const metrics = await SystemMetric.find({ type })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    return metrics.reverse();
  }
}
