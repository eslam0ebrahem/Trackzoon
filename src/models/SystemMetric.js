import mongoose from 'mongoose';

const SystemMetricSchema = new mongoose.Schema({
    timestamp: { type: Date, default: Date.now },
    type: { type: String, enum: ['scraper', 'database', 'system', 'extension'], required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true }
});

// Index for time-series queries
SystemMetricSchema.index({ timestamp: -1 });
SystemMetricSchema.index({ type: 1, timestamp: -1 });
// TTL index: auto-delete metrics older than 30 days
SystemMetricSchema.index({ timestamp: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export default mongoose.models.SystemMetric || mongoose.model('SystemMetric', SystemMetricSchema);
