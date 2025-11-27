import mongoose from 'mongoose';

const PricePointSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    asin: { type: String, required: true, index: true },
    price: { type: Number, required: true },
    date: { type: Date, default: Date.now, index: true },
    // Optional metadata
    condition: String,
    merchant: String
});

// Compound index for efficient querying and preventing duplicates
PricePointSchema.index({ asin: 1, date: -1 }, { unique: true });

export default mongoose.models.PricePoint || mongoose.model('PricePoint', PricePointSchema);
