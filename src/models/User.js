import mongoose from 'mongoose';

const userSettingsSchema = new mongoose.Schema({
  notifications: {
    type: Boolean,
    default: true
  },
  dailyReport: {
    type: Boolean,
    default: false
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  currency: {
    type: String,
    default: 'EGP'
  },
  language: {
    type: String,
    default: 'en'
  },
  quietMode: {
    enabled: { type: Boolean, default: false },
    startHour: { type: Number, default: 22 }, // 10 PM
    endHour: { type: Number, default: 8 }     // 8 AM
  },
  minDiscount: {
    type: Number,
    default: 0 // Notify on any drop
  },
  alertSensitivity: {
    type: String,
    enum: ['aggressive', 'balanced', 'strict'],
    default: 'balanced'
  },
  autoTarget: {
    enabled: { type: Boolean, default: false }
  },
  watchAgain: {
    enabled: { type: Boolean, default: false }
  },
  dropProbabilityAlerts: {
    enabled: { type: Boolean, default: false },
    threshold: { type: Number, default: 65 }
  }
});

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  firstName: String,
  username: String,
  webhookUrl: { type: String }, // Feature 17: Webhook
  apiKey: { type: String }, // Feature 20: API Key
  isAdmin: { type: Boolean, default: false }, // Admin Dashboard
  joinedAt: { type: Date, default: Date.now },
  settings: {
    type: userSettingsSchema,
    default: () => ({})
  },
  // products: ... // Removed in v2 migration
  // Savings tracking
  savings: {
    total: { type: Number, default: 0 },
    priceDrops: { type: Number, default: 0 },
    waitedForDeals: { type: Number, default: 0 },
    flashDeals: { type: Number, default: 0 },
    history: [{
      amount: Number,
      type: { type: String, enum: ['price_drop', 'waited_for_deal', 'flash_deal'] },
      productName: String,
      productUrl: String,
      originalPrice: Number,
      finalPrice: Number,
      date: { type: Date, default: Date.now }
    }]
  },
  // Product ratings cache
  productRatings: [{
    asin: String,
    rating: Number,
    reviewCount: Number,
    lastUpdated: Date
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  }
});

// Update lastActive timestamp
userSchema.pre('save', function (next) {
  this.lastActive = new Date();
  next();
});

const User = mongoose.model('User', userSchema);

export default User;
