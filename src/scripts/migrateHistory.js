import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../models/Product.js';
import PricePoint from '../models/PricePoint.js';
import { logger } from '../utils/logger.js';

dotenv.config();

const migrateHistory = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        logger.info('Connected to MongoDB');

        const products = await Product.find({});
        logger.info(`Found ${products.length} products to migrate`);

        let totalPoints = 0;

        for (const product of products) {
            if (!product.priceHistory || product.priceHistory.length === 0) continue;

            const pricePoints = product.priceHistory.map(entry => ({
                product: product._id,
                asin: product.asin,
                price: entry.price,
                date: entry.date,
                merchant: product.merchant // Best guess for historical data
            }));

            if (pricePoints.length > 0) {
                try {
                    // Use insertMany for bulk insertion
                    await PricePoint.insertMany(pricePoints, { ordered: false });
                    totalPoints += pricePoints.length;
                    logger.info(`Migrated ${pricePoints.length} points for ${product.asin}`);
                } catch (err) {
                    // Ignore duplicate key errors if running multiple times
                    if (err.code !== 11000) {
                        logger.error(`Error migrating ${product.asin}:`, err);
                    }
                }
            }
        }

        logger.info(`Migration complete! Total PricePoints created: ${totalPoints}`);
        process.exit(0);
    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }
};

migrateHistory();
