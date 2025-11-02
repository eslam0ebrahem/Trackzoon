// src/models/User.js
import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema({
  chatId: String,
  products: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  state: Object, // To store multi-step command state
});
export default mongoose.models.User || mongoose.model('User', UserSchema);
