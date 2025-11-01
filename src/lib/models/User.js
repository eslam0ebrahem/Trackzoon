// src/models/User.js
import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema({
  chatId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
  }],
  locale: {
    type: String,
    required: true,
    default: 'en',
    enum: ['en', 'ar'], // Assuming 'en' and 'ar' are the only supported locales
  },
}, { timestamps: true });
export default mongoose.models.User || mongoose.model('User', UserSchema);
