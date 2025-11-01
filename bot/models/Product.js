// src/models/Product.js
import mongoose from 'mongoose';
const ProductSchema = new mongoose.Schema({
  asin: String,
  url: String,
  name: String,
  trackedBy: [{
    chatId: Number,
    muteUntil: Date,
    lastAlertedAt: Date,
    alertType: String, // 'drop' or 'percentage'
    percentageThreshold: Number, // For percentage-based alerts
  }],
  thresholdPrice: Number,
  priceHistory: [
    { price: Number, date: Date }
  ]
});
export default mongoose.models.Product || mongoose.model('Product', ProductSchema);
