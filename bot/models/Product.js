// src/models/Product.js
import mongoose from 'mongoose';
const ProductSchema = new mongoose.Schema({
  asin: { type: String, required: true, index: true },
  url: { type: String, required: true },
  name: { type: String, required: true },
  currentPrice: { type: Number, default: 0 },
  lastChecked: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
  trackedBy: [{
    chatId: { type: Number, required: true },
    muteUntil: Date,
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
export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
