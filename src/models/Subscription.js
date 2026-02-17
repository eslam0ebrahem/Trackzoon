import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, index: true },

    // User-specific settings for this product
    isPinned: { type: Boolean, default: false, index: true },
    targetPrice: { type: Number }, // Renamed from thresholdPrice for clarity
    alertType: { type: String, enum: ['drop', 'percentage'], default: 'drop' },
    percentageThreshold: { type: Number }, // For percentage based alerts
    baselinePrice: { type: Number }, // Reference price for percentage alerts
    snoozeUntil: { type: Date },

    // Metadata
    createdAt: { type: Date, default: Date.now },
    lastAlertedAt: { type: Date },
    lastFlashDealAlert: { type: Date },
    lastProbabilityAlertAt: { type: Date }
});

// Compound index: A user can track a product only once
SubscriptionSchema.index({ user: 1, product: 1 }, { unique: true });

export default mongoose.models.Subscription || mongoose.model('Subscription', SubscriptionSchema);
