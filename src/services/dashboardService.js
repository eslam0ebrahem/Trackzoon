import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import PricePoint from '../models/PricePoint.js';
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
