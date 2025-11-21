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
  }
});

const userSchema = new mongoose.Schema({
  chatId: {
    type: Number,
    required: true,
    unique: true
  },
  username: String,
  firstName: String,
  lastName: String,
  settings: {
    type: userSettingsSchema,
    default: () => ({})
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],
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
userSchema.pre('save', function(next) {
  this.lastActive = new Date();
  next();
});

const User = mongoose.model('User', userSchema);

export default User;
