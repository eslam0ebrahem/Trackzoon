// src/models/Product.js
import mongoose from 'mongoose';

// Configuration constants
const MAX_PRICE_HISTORY_ENTRIES = 100; // Keep last 100 price records (Hybrid approach)
const PRICE_HISTORY_DAYS_TO_KEEP = 90; // Keep last 90 days

const ProductSchema = new mongoose.Schema({
  asin: { type: String, required: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  imageUrl: { type: String },
  currentPrice: { type: Number, default: 0 },
  isOutOfStock: { type: Boolean, default: false },
  isArchived: { type: Boolean, default: false }, // Feature 8: Archive
  tags: [{ type: String }], // Feature 6: Tagging
  outOfStockSince: { type: Date, default: null }, // Track when product went out of stock
  lastChecked: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  // trackedBy: [{ ... }] // Removed in v2 migration
  thresholdPrice: { type: Number },
  priceHistory: [{
    price: { type: Number, required: true },
    date: { type: Date, default: Date.now }
  }],
  stockHistory: [{
    status: { type: String, enum: ['in_stock', 'out_of_stock'], required: true },
    date: { type: Date, default: Date.now }
  }],
  // Product rating information
  rating: {
    stars: { type: Number, min: 0, max: 5 },
    count: { type: Number, default: 0 },
    lastUpdated: { type: Date }
  },
  // Smart Tracking Fields
  volatilityScore: { type: Number, default: 0 }, // 0 to 10 scale of price volatility
  checkInterval: { type: Number, default: 30 }, // Minutes between checks (dynamic)

  // Smart Database Fields (Phase 7)
  category: { type: String }, // Auto-categorized
  stats: {
    min: { type: Number, default: 0 },
    max: { type: Number, default: 0 },
    avg: { type: Number, default: 0 },
    volatility: { type: Number, default: 0 }
  },
  nextCheck: { type: Date, default: Date.now }, // Optimized Scheduling
  lastPriceChange: {
    date: { type: Date },
    oldPrice: Number,
    newPrice: Number,
    diff: Number,
    percent: Number
  },

  // Smart Metrics (Pre-calculated for performance & consistency)
  smartScore: { type: Number, default: 0, index: true }, // 0-100 score
  dealLabel: { type: String, enum: ['hot_deal', 'good_deal', 'fair_price', 'price_hike', 'stable'], default: 'fair_price' },
  discountPercentage: { type: Number, default: 0, index: true }, // Always negative for drops
  lastDropDate: { type: Date, index: true }, // Date of last price drop

  // AI Analysis Fields
  aiAnalysis: { type: String }, // Text explanation from AI
  lastAiAnalysis: { type: Date }, // When AI last analyzed this product
  aiAnalysisConfidence: { type: Number }, // Confidence in AI analysis
  aiPrediction: {
    trend: { type: String, enum: ['DROP', 'RISE', 'STABLE', 'UNKNOWN'] },
    confidence: Number,
    reason: String,
    lastUpdated: Date
  },

  // Enhanced Data Fields
  merchant: { type: String }, // e.g., "Amazon.eg" or third-party seller name
  prime: { type: Boolean, default: false }, // Is it a Prime item?
  delivery: {
    date: String, // e.g., "Tomorrow, 22 November"
    price: String, // e.g., "FREE" or "EGP 20.00"
    message: String // Full delivery message
  },
  coupon: { type: String }, // Coupon text/value if available
  dealProgress: { type: Number }, // Percentage claimed for lightning deals
  otherSellers: [{
    price: Number,
    condition: String,
    seller: String
  }],

  // Anomaly Detection
  anomaly: {
    isAnomaly: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    reason: { type: String },
    detectedAt: { type: Date }
  },

  // Market Intelligence (Perplexity API)
  marketComparisonData: [{
    platform: String, // e.g., "Noon", "Jumia"
    price: Number,
    url: String,
    lastChecked: { type: Date, default: Date.now }
  }],
  aiBuyingAdvice: {
    advice: { type: String, enum: ['wait', 'buy_now', 'neutral'], default: 'neutral' },
    reasoning: String,
    newsSummary: String,
    lastUpdated: { type: Date, default: Date.now }
  }
});

// Indexes for performance optimization (Phase 1)
ProductSchema.index({ asin: 1 }, { unique: true });
// trackedBy indexes removed (field removed in v2 migration)
ProductSchema.index({ lastChecked: 1 }); // For finding stale products
ProductSchema.index({ nextCheck: 1 }); // For optimized scheduler
ProductSchema.index({ category: 1 });
ProductSchema.index({ 'stats.min': 1 });
ProductSchema.index({ 'lastPriceChange.date': -1 });
ProductSchema.index({ 'lastPriceChange.percent': 1 }); // For finding biggest drops

// Pre-save hook to limit price history size
ProductSchema.pre('save', function (next) {
  if (this.priceHistory && this.priceHistory.length > 0) {
    // Strategy 1: Limit by count (keep last 1000 entries)
    if (this.priceHistory.length > MAX_PRICE_HISTORY_ENTRIES) {
      this.priceHistory = this.priceHistory.slice(-MAX_PRICE_HISTORY_ENTRIES);
      console.log(`Trimmed price history for ${this.asin} to ${MAX_PRICE_HISTORY_ENTRIES} entries`);
    }

    // Strategy 2: Limit by age (keep last 90 days)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - PRICE_HISTORY_DAYS_TO_KEEP);

    const oldLength = this.priceHistory.length;
    this.priceHistory = this.priceHistory.filter(entry =>
      new Date(entry.date) >= cutoffDate
    );

    if (this.priceHistory.length < oldLength) {
      console.log(`Removed ${oldLength - this.priceHistory.length} old price entries for ${this.asin}`);
    }

  }

  // Limit stock history size (keep last 100 entries)
  if (this.stockHistory && this.stockHistory.length > 100) {
    this.stockHistory = this.stockHistory.slice(-100);
  }
  next();
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
