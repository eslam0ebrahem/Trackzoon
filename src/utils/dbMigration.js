import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { calculatePriceStats } from './priceUtils.js';
import { logger } from './logger.js';

export const migrateSmartFields = async () => {
    logger.info('Starting Smart Database Migration...');

    try {
        const products = await Product.find({});
        let updatedCount = 0;

        for (const product of products) {
            let needsUpdate = false;

            // 1. Calculate Stats
            if (!product.stats || product.stats.min === 0) {
                const stats = calculatePriceStats(product.priceHistory, 365); // All time
                if (stats) {
                    product.stats = {
                        min: stats.min,
                        max: stats.max,
                        avg: stats.average,
                        volatility: 0 // Placeholder
                    };
                    needsUpdate = true;
                }
            }

            // 2. Auto-Categorize
            if (!product.category) {
                const name = product.name.toLowerCase();
                if (name.match(/laptop|phone|monitor|usb|cable|mouse|keyboard|screen|tv|audio|headphone|camera|watch/)) {
                    product.category = 'Electronics';
                } else if (name.match(/chair|desk|pan|pot|blender|fryer|knife|bed|pillow|lamp|furniture|kitchen/)) {
                    product.category = 'Home & Kitchen';
                } else if (name.match(/shirt|pant|shoe|bag|wallet|dress|clothing|fashion/)) {
                    product.category = 'Fashion';
                } else if (name.match(/cream|shampoo|soap|perfume|makeup|skin|hair/)) {
                    product.category = 'Beauty';
                } else if (name.match(/toy|game|puzzle|lego/)) {
                    product.category = 'Toys';
                } else {
                    product.category = 'Other';
                }
                needsUpdate = true;
            }

            // 3. Last Price Change
            if (!product.lastPriceChange || !product.lastPriceChange.date) {
                if (product.priceHistory.length >= 2) {
                    // Find last change
                    for (let i = product.priceHistory.length - 1; i > 0; i--) {
                        const current = product.priceHistory[i];
                        const prev = product.priceHistory[i - 1];
                        if (current.price !== prev.price) {
                            product.lastPriceChange = {
                                date: current.date,
                                oldPrice: prev.price,
                                newPrice: current.price,
                                diff: current.price - prev.price,
                                percent: ((current.price - prev.price) / prev.price) * 100
                            };
                            needsUpdate = true;
                            break;
                        }
                    }
                }
            }

            if (needsUpdate) {
                await product.save();
                updatedCount++;
            }
        }

        logger.info(`Migration complete. Updated ${updatedCount} products.`);
        return updatedCount;

    } catch (error) {
        logger.error('Migration failed:', error);
        throw error;
    }
};
