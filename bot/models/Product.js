// src/models/Product.js
import mongoose from 'mongoose';

// Configuration constants
const MAX_PRICE_HISTORY_ENTRIES = 1000; // Keep last 1000 price records
const PRICE_HISTORY_DAYS_TO_KEEP = 90; // Keep last 90 days

const ProductSchema = new mongoose.Schema({
  asin: { type: String, required: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  currentPrice: { type: Number, default: 0 },
  isOutOfStock: { type: Boolean, default: false },
  outOfStockSince: { type: Date, default: null }, // Track when product went out of stock
  lastChecked: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  trackedBy: [{
    chatId: { type: Number, required: true },
    lastAlertedAt: Date,
    alertType: { type: String, enum: ['drop', 'percentage_drop'], default: 'drop' },
    thresholdPrice: { type: Number },
    percentageThreshold: Number,
  }],
  thresholdPrice: { type: Number },
  priceHistory: [{
    price: { type: Number, required: true },
    date: { type: Date, default: Date.now }
  }]
});

// Indexes for performance optimization (Phase 1)
ProductSchema.index({ asin: 1 }, { unique: true });
ProductSchema.index({ 'trackedBy.chatId': 1 });
ProductSchema.index({ asin: 1, 'trackedBy.chatId': 1 });
ProductSchema.index({ lastChecked: 1 }); // For finding stale products

// Pre-save hook to limit price history size
ProductSchema.pre('save', function(next) {
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
  next();
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
