import mongoose from 'mongoose';
import SystemMetric from '../models/SystemMetric.js';
import Product from '../models/Product.js';
import User from '../models/User.js';
import { getAiBudgetTelemetry } from '../utils/aiGuard.js';
import cache from '../config/cache.js';
import { priceCheckQueue } from '../queue/priceQueue.js';
import { aiAvailabilityQueue } from '../queue/aiAvailabilityQueue.js';

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
      },
      cache: cache.getHealth()
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

  static async getQueueStatus() {
    try {
      const [priceCounts, aiCounts] = await Promise.all([
        priceCheckQueue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed'),
        aiAvailabilityQueue.getJobCounts('active', 'waiting', 'completed', 'failed', 'delayed')
      ]);

      const totalActive = (priceCounts.active || 0) + (aiCounts.active || 0);
      const totalWaiting = (priceCounts.waiting || 0) + (aiCounts.waiting || 0);
      const totalCompleted = (priceCounts.completed || 0) + (aiCounts.completed || 0);
      const totalFailed = (priceCounts.failed || 0) + (aiCounts.failed || 0);
      const totalDelayed = (priceCounts.delayed || 0) + (aiCounts.delayed || 0);

      return {
        active: totalActive,
        waiting: totalWaiting,
        pending: totalWaiting + totalDelayed,
        completed: totalCompleted,
        failed: totalFailed,
        delayed: totalDelayed,
        queues: {
          priceCheck: priceCounts,
          aiAvailability: aiCounts
        }
      };
    } catch (error) {
      return {
        active: 0,
        waiting: 0,
        pending: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        error: error.message
      };
    }
  }

  static async getMetricsHistory(type, limit = 24) {
    const metrics = await SystemMetric.find({ type })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10));

    return metrics.reverse();
  }

  static async getAiBudget() {
    return getAiBudgetTelemetry();
  }
}
