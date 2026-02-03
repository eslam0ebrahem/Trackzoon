import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import PricePoint from '../models/PricePoint.js';
import { ProductService } from './productService.js';
import { DASHBOARD_USER_ID } from '../config/constants.js';

export class DashboardService {
  static async getStats() {
    const [totalProducts, totalUsers, totalTrackedItems] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Subscription.countDocuments()
    ]);

    return { totalProducts, totalUsers, totalTrackedItems };
  }

  static async getDeals({ page = 1, limit = 20, sort = 'smart', chatId = null }) {
    const scope = chatId ? 'user' : 'global';
    return ProductService.getDealsUnified({ page, limit, sort, scope, chatId });
  }

  static async addProduct(url, chatId = DASHBOARD_USER_ID, threshold = 0) {
    return ProductService.addProduct(url, chatId, threshold);
  }

  static async previewProduct(url) {
    return ProductService.previewProduct(url);
  }

  static async getProductHistory(asin) {
    const product = await Product.findOne({ asin });
    if (!product) return null;

    const pricePoints = await PricePoint.find({ product: product._id })
      .sort({ date: 1 })
      .lean();

    const history = pricePoints.length > 0
      ? pricePoints.map(p => ({ price: p.price, date: p.date }))
      : (product.priceHistory || []);

    return {
      name: product.name,
      currentPrice: product.currentPrice,
      history,
      image: product.imageUrl
    };
  }

  static async getCategoryStats() {
    const stats = await Product.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    const labels = [];
    const data = [];

    stats.forEach(s => {
      if (s._id) {
        labels.push(s._id);
        data.push(s.count);
      }
    });

    return { labels, data };
  }

  static async searchProducts(query) {
    if (!query || query.length < 2) return [];

    return Product.find({
      name: { $regex: query, $options: 'i' }
    })
      .limit(10)
      .select('name asin currentPrice imageUrl isOutOfStock');
  }

  static async getRecentActivity() {
    return Product.find({})
      .sort({ lastChecked: -1 })
      .limit(10)
      .select('name asin currentPrice lastChecked imageUrl isOutOfStock');
  }

  static async getTopTracked() {
    return Subscription.aggregate([
      { $group: { _id: '$product', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'products', localField: '_id', foreignField: '_id', as: 'product' } },
      { $unwind: '$product' },
      {
        $project: {
          name: '$product.name',
          asin: '$product.asin',
          currentPrice: '$product.currentPrice',
          imageUrl: '$product.imageUrl',
          trackerCount: '$count'
        }
      }
    ]);
  }

  static async exportCsv() {
    const products = await Product.aggregate([
      {
        $lookup: {
          from: 'subscriptions',
          localField: '_id',
          foreignField: 'product',
          as: 'subscriptions'
        }
      },
      {
        $addFields: {
          trackerCount: { $size: '$subscriptions' }
        }
      }
    ]);

    const headers = ['ASIN', 'Name', 'URL', 'Current Price', 'Highest Price', 'Lowest Price', 'Trackers'];
    const rows = products.map(p => {
      const prices = Array.isArray(p.priceHistory) ? p.priceHistory.map(h => h.price) : [];
      const max = prices.length > 0 ? Math.max(...prices) : p.currentPrice;
      const min = prices.length > 0 ? Math.min(...prices) : p.currentPrice;

      return [
        p.asin,
        `"${p.name.replace(/"/g, '""')}"`,
        p.url,
        p.currentPrice,
        max,
        min,
        p.trackerCount
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  static getLogs(level, search) {
    let events = [
      { level: 'info', message: 'Server started successfully', time: new Date(Date.now() - 1000000).toISOString() },
      { level: 'info', message: 'Connected to MongoDB', time: new Date(Date.now() - 990000).toISOString() },
      { level: 'info', message: 'Scheduler initialized', time: new Date(Date.now() - 980000).toISOString() },
      { level: 'info', message: 'Price check cycle started', time: new Date(Date.now() - 500000).toISOString() },
      { level: 'info', message: 'Checked 150 products', time: new Date(Date.now() - 400000).toISOString() },
      { level: 'warn', message: 'Rate limit warning from Amazon (simulated)', time: new Date(Date.now() - 300000).toISOString() },
      { level: 'error', message: 'Failed to scrape product B08XYZ123', time: new Date(Date.now() - 250000).toISOString() },
      { level: 'info', message: 'Price check cycle completed', time: new Date(Date.now() - 200000).toISOString() },
      { level: 'info', message: 'New deal found: Samsung Monitor', time: new Date(Date.now() - 100000).toISOString() }
    ];

    if (level && level !== 'all') {
      events = events.filter(e => e.level === level);
    }

    if (search) {
      const q = search.toLowerCase();
      events = events.filter(e => e.message.toLowerCase().includes(q));
    }

    return events.reverse();
  }

  static async bulkImportProducts(urls, chatId = DASHBOARD_USER_ID) {
    const results = {
      success: 0,
      failed: 0,
      errors: []
    };

    for (const url of urls) {
      try {
        await ProductService.addProduct(url, chatId, 0);
        results.success++;
      } catch (error) {
        results.failed++;
        results.errors.push({ url, error: error.message });
      }
    }

    return results;
  }

  static async updateTags(asin, tags) {
    return Product.findOneAndUpdate(
      { asin },
      { $set: { tags } },
      { new: true }
    );
  }

  static async updateTargetPrice(asin, targetPrice) {
    return Product.findOneAndUpdate(
      { asin },
      { $set: { thresholdPrice: targetPrice } },
      { new: true }
    );
  }

  static async archiveProduct(asin, isArchived) {
    return Product.findOneAndUpdate(
      { asin },
      { $set: { isArchived } },
      { new: true }
    );
  }

  static async getUserProducts(chatId) {
    return ProductService.getUserProducts(chatId);
  }
}
