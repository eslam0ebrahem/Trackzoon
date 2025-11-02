// src/models/Product.js
import mongoose from 'mongoose';
const ProductSchema = new mongoose.Schema({
  asin: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  url: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  trackedBy: [
    {
      chatId: {
        type: Number,
        required: true,
        index: true,
      },
      lastAlertedAt: {
        type: Date,
        default: null,
      },
      alertType: {
        type: String,
        enum: ['drop', 'change', 'rise', 'percentage_drop'],
        default: 'drop',
      },
      percentageThreshold: {
        type: Number,
        default: null,
        min: 0,
      },
    },
  ],
  thresholdPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  priceHistory: [
    {
      price: {
        type: Number,
        required: true,
        min: 0,
      },
      date: {
        type: Date,
        required: true,
        default: Date.now,
      },
    },
  ],
}, { timestamps: true });
export default mongoose.models.Product || mongoose.model('Product', ProductSchema);