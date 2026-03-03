import mongoose from 'mongoose';
import { logger } from '../utils/logger.js';

const connectDB = async () => {
  try {
    // Add database name if not in URI
    let mongoUri = process.env.MONGODB_URI;
    if (!mongoUri.includes('?') && !mongoUri.endsWith('/')) {
      mongoUri += '/trackzoon?retryWrites=true&w=majority';
    } else if (!mongoUri.includes('?')) {
      mongoUri += '?retryWrites=true&w=majority';
    }

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 30000, // 30 second timeout
      socketTimeoutMS: 45000,
    });
    logger.info('MongoDB connected.');
  } catch (err) {
    logger.error('MongoDB connection error:', err.message);
    logger.error('\n⚠️  IP Whitelist Issue? Add 0.0.0.0/0 to MongoDB Atlas Network Access');
    logger.error('   Visit: https://cloud.mongodb.com → Network Access → Add IP Address\n');
    process.exit(1);
  }
};

export default connectDB;