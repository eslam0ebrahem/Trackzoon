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
}, { timestamps: true });
export default mongoose.models.User || mongoose.model('User', UserSchema);
