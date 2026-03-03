import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import PricePoint from '../models/PricePoint.js';
import SystemMetric from '../models/SystemMetric.js';
import Notification from '../models/Notification.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { ProductService } from './productService.js';
import { DASHBOARD_USER_ID } from '../config/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOGS_DIR = path.resolve(__dirname, '../../logs');
const LOG_FILE_PATTERN = /^(app|error)-\d{4}-\d{2}-\d{2}\.log$/;
const LOG_LINE_PATTERN = /^\[(.+?)\]\s\[(\w+)\]\s(.+)$/;

const normalizeLevel = (level = '') => String(level || '').toLowerCase();

const parseLogLine = (line = '') => {
  const match = line.match(LOG_LINE_PATTERN);
  if (!match) return null;

  const [, rawTime, rawLevel, rawMessage] = match;
  const parsed = new Date(rawTime.replace(' ', 'T'));
  const time = Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();

  return {
    time,
    level: normalizeLevel(rawLevel),
    message: rawMessage.trim()
  };
};

export class DashboardService {
  static async getStats() {
    const [totalProducts, totalUsers, totalTrackedItems] = await Promise.all([
      Product.countDocuments(),
      User.countDocuments(),
      Subscription.countDocuments()
    ]);

    return { totalProducts, totalUsers, totalTrackedItems };
  }

  static async getAnalyticsDashboard(chatId) {
    const user = chatId ? await User.findOne({ telegramId: String(chatId) }) : null;

    const productMatch = {};
    if (user) {
      const subs = await Subscription.find({ user: user._id }).select('product');
      const productIds = subs.map(s => s.product);
      productMatch._id = { $in: productIds };
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const products = await Product.find(productMatch)
      .select('category currentPrice smartScore volatilityScore priceHistory')
      .lean();

    const categoryCount = {};
    const scoreRanges = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };
    const categoryVolatility = {};

    products.forEach(p => {
      const cat = p.category || 'Other';
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;

      const score = p.smartScore || 0;
      if (score <= 20) scoreRanges['0-20']++;
      else if (score <= 40) scoreRanges['21-40']++;
      else if (score <= 60) scoreRanges['41-60']++;
      else if (score <= 80) scoreRanges['61-80']++;
      else scoreRanges['81-100']++;

      if (!categoryVolatility[cat]) categoryVolatility[cat] = { sum: 0, count: 0 };
      categoryVolatility[cat].sum += (p.volatilityScore || 0);
      categoryVolatility[cat].count++;
    });

    const trendDatas = [];
    for (let i = 6; i >= 0; i--) {
      const dateOffset = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      let dailyTotal = 0;
      let dailyCount = 0;

      products.forEach(p => {
        let closestPrice = p.currentPrice || 0;
        if (p.priceHistory && p.priceHistory.length > 0) {
          const pastPrices = p.priceHistory.filter(h => new Date(h.date) <= dateOffset);
          if (pastPrices.length > 0) {
            closestPrice = pastPrices[pastPrices.length - 1].price || closestPrice;
          }
        }
        dailyTotal += closestPrice;
        dailyCount++;
      });

      const dailyAvg = dailyCount ? dailyTotal / dailyCount : 0;
      trendDatas.push(Number(dailyAvg.toFixed(2)));
    }

    const sortedCats = Object.entries(categoryCount).sort((a, b) => b[1] - a[1]);
    const topCats = sortedCats.slice(0, 5);
    let otherCount = sortedCats.slice(5).reduce((acc, val) => acc + val[1], 0);

    const categoryLabels = topCats.map(c => c[0]);
    const categoryData = topCats.map(c => c[1]);
    if (otherCount > 0) {
      categoryLabels.push('Other');
      categoryData.push(otherCount);
    }

    const alertData = [];
    const notifMatch = { createdAt: { $gte: sevenDaysAgo } };
    if (user) notifMatch.user = user._id;

    const notifs = await Notification.find(notifMatch).select('createdAt').lean();
    for (let i = 6; i >= 0; i--) {
      const startOfDay = new Date();
      startOfDay.setDate(startOfDay.getDate() - i);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(startOfDay);
      endOfDay.setHours(23, 59, 59, 999);

      const count = notifs.filter(n => new Date(n.createdAt) >= startOfDay && new Date(n.createdAt) <= endOfDay).length;
      alertData.push(count);
    }

    const volatilityHeatmap = {
      categories: categoryLabels.filter(c => c !== 'Other').slice(0, 4),
      days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
      data: []
    };

    volatilityHeatmap.categories.forEach((cat, catIdx) => {
      const stat = categoryVolatility[cat];
      const avgVol = stat && stat.count ? stat.sum / stat.count : 0;
      const normalized = Math.min(1, Math.max(0, avgVol / 10)); // 0-1

      const catDays = [];
      for (let i = 0; i < 7; i++) {
        // Deterministic variation based on category index and day
        const seed = ((catIdx + 1) * 31 + (i + 1) * 17) % 100;
        const variation = (seed / 100) * 0.4 - 0.2; // -0.2 to +0.2 range
        catDays.push(Number(Math.max(0, Math.min(1, normalized + variation)).toFixed(2)));
      }
      volatilityHeatmap.data.push(catDays);
    });

    return {
      trend: trendDatas,
      categories: { labels: categoryLabels, data: categoryData },
      scores: { labels: Object.keys(scoreRanges), data: Object.values(scoreRanges) },
      alerts: alertData,
      volatility: volatilityHeatmap
    };
  }

  static async getDeals({ page = 1, limit = 20, sort = 'smart', chatId = null, minDiscount = 0 }) {
    const scope = chatId ? 'user' : 'global';
    return ProductService.getDealsUnified({ page, limit, sort, scope, chatId, minDiscount });
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

    const headers = [
      'ASIN',
      'Name',
      'URL',
      'Current Price',
      '30d Avg',
      '30d Min',
      '30d Max',
      'Smart Score',
      'Deal Label',
      'Discount %',
      'Last Drop Date',
      'Category',
      'Tags',
      'Merchant',
      'Prime',
      'Rating',
      'Reviews',
      'Out Of Stock',
      'Trackers'
    ];
    const rows = products.map(p => {
      const prices = Array.isArray(p.priceHistory) ? p.priceHistory.map(h => h.price) : [];
      const max = p.stats?.max || (prices.length > 0 ? Math.max(...prices) : p.currentPrice);
      const min = p.stats?.min || (prices.length > 0 ? Math.min(...prices) : p.currentPrice);
      const avg = p.stats?.avg || (prices.length > 0 ? (prices.reduce((a, b) => a + b, 0) / prices.length) : p.currentPrice);
      const tags = Array.isArray(p.tags) ? p.tags.join('|') : '';
      const discount = typeof p.discountPercentage === 'number' ? p.discountPercentage.toFixed(1) : '0.0';
      const rating = p.rating?.stars ? p.rating.stars.toFixed(1) : '';
      const reviewCount = p.rating?.count ?? '';

      return [
        p.asin,
        `"${p.name.replace(/"/g, '""')}"`,
        p.url,
        p.currentPrice,
        avg,
        min,
        max,
        p.smartScore || 0,
        p.dealLabel || '',
        discount,
        p.lastDropDate ? new Date(p.lastDropDate).toISOString() : '',
        p.category || '',
        `"${String(tags).replace(/"/g, '""')}"`,
        p.merchant || '',
        p.prime ? 'Yes' : 'No',
        rating,
        reviewCount,
        p.isOutOfStock ? 'Yes' : 'No',
        p.trackerCount
      ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  static async getLogs(level = 'all', search = '', limit = 300) {
    const wantedLevel = normalizeLevel(level);
    const query = String(search || '').toLowerCase().trim();
    const safeLimit = Math.max(1, Math.min(1000, Number.parseInt(limit, 10) || 300));

    let filenames = [];
    try {
      filenames = await fs.readdir(LOGS_DIR);
    } catch (error) {
      return [];
    }

    const files = filenames
      .filter(name => LOG_FILE_PATTERN.test(name))
      .sort((a, b) => a.localeCompare(b))
      .slice(-5);

    const events = [];
    for (const name of files) {
      const fullPath = path.join(LOGS_DIR, name);
      let content = '';
      try {
        content = await fs.readFile(fullPath, 'utf8');
      } catch (error) {
        continue;
      }

      const lines = content.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        const parsed = parseLogLine(line);
        if (!parsed) continue;
        if (wantedLevel && wantedLevel !== 'all' && parsed.level !== wantedLevel) continue;
        if (query && !parsed.message.toLowerCase().includes(query)) continue;
        events.push(parsed);
      }
    }

    events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return events.slice(0, safeLimit);
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

  static async updateTargetPrice(asin, targetPrice, chatId = null) {
    // Update target price on the user's subscription (user-specific setting)
    const product = await Product.findOne({ asin });
    if (!product) return null;

    if (chatId) {
      const user = await User.findOne({ telegramId: String(chatId) });
      if (user) {
        const sub = await Subscription.findOneAndUpdate(
          { user: user._id, product: product._id },
          { $set: { targetPrice } },
          { new: true }
        );
        if (sub) return { asin, targetPrice: sub.targetPrice, scope: 'subscription' };
      }
    }

    // Fallback: update product-level threshold for backwards compatibility
    const updated = await Product.findOneAndUpdate(
      { asin },
      { $set: { thresholdPrice: targetPrice } },
      { new: true }
    );
    return updated;
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

  static async getExtensionStats(hours = 24) {
    const safeHours = Math.max(1, Math.min(168, Number(hours) || 24));
    const since = new Date(Date.now() - safeHours * 60 * 60 * 1000);

    const metrics = await SystemMetric.find({
      type: 'extension',
      timestamp: { $gte: since }
    })
      .sort({ timestamp: -1 })
      .limit(2000)
      .lean();

    const summary = {
      windowHours: safeHours,
      total: metrics.length,
      successes: 0,
      failures: 0,
      created: 0,
      updated: 0,
      newProduct: 0,
      aiCorrected: 0,
      avgDurationMs: 0,
      lastSyncAt: metrics[0]?.timestamp || null,
      topAvailabilityReasons: []
    };

    const reasonCount = new Map();
    let durationTotal = 0;
    let durationCount = 0;

    for (const event of metrics) {
      const data = event?.data || {};
      if (data.status === 'error') {
        summary.failures += 1;
      } else {
        summary.successes += 1;
      }

      if (data.action === 'created') summary.created += 1;
      if (data.action === 'updated') summary.updated += 1;
      if (data.action === 'new_product') summary.newProduct += 1;
      if (data.aiCorrected) summary.aiCorrected += 1;

      if (Number.isFinite(data.durationMs) && data.durationMs >= 0) {
        durationTotal += data.durationMs;
        durationCount += 1;
      }

      if (data.availabilityReason) {
        reasonCount.set(data.availabilityReason, (reasonCount.get(data.availabilityReason) || 0) + 1);
      }
    }

    summary.avgDurationMs = durationCount > 0 ? Math.round(durationTotal / durationCount) : 0;
    summary.topAvailabilityReasons = Array.from(reasonCount.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return summary;
  }

  static async deleteProduct(asin) {
    const product = await Product.findOne({ asin });
    if (!product) return null;

    // Clean up all related data
    const [subResult, ppResult] = await Promise.all([
      Subscription.deleteMany({ product: product._id }),
      PricePoint.deleteMany({ asin: product.asin })
    ]);

    await Product.deleteOne({ _id: product._id });

    return {
      deleted: true,
      asin,
      cleanup: {
        subscriptions: subResult.deletedCount,
        pricePoints: ppResult.deletedCount
      }
    };
  }
}
