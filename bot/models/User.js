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
  defaultAlertType: {
    type: String,
    enum: ['fixed', 'percentage'],
    default: 'fixed'
  },
  minPriceDrop: {
    type: Number,
    default: 5,
    min: 0,
    max: 100
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
    type: String,
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
