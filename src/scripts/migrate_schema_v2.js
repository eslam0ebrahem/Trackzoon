import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import connectDB from '../config/db.js';
import { logger } from '../utils/logger.js';

const migrate = async () => {
    try {
        await connectDB();
        logger.info('Starting migration: Product.trackedBy -> Subscription collection');

        // Start a session for transaction
        const session = await mongoose.startSession();

        try {
            await session.withTransaction(async () => {
                // Find all products that have trackers
                const cursor = Product.find({ 'trackedBy.0': { $exists: true } }).cursor();
                let totalSubscriptions = 0;
                let processedProducts = 0;

                for (let product = await cursor.next(); product != null; product = await cursor.next()) {
                    processedProducts++;
                    const newSubscriptions = [];

                    for (const tracker of product.trackedBy) {
                        // Find the user by telegramId to get their ObjectId
                        // Note: We use session to ensure consistency, but User lookups might be cached or outside transaction if not careful.
                        // Mongoose queries with session option are part of the transaction.
                        const user = await User.findOne({ telegramId: tracker.chatId }).session(session);

                        if (user) {
                            newSubscriptions.push({
                                user: user._id,
                                product: product._id,
                                targetPrice: tracker.thresholdPrice,
                                percentageThreshold: tracker.percentageThreshold,
                                alertType: tracker.alertType || 'drop',
                                snoozeUntil: tracker.snoozeUntil,
                                lastAlertedAt: tracker.lastAlertedAt,
                                lastFlashDealAlert: tracker.lastFlashDealAlert,
                                createdAt: tracker.lastAlertedAt || new Date() // Best guess for creation date
                            });
                        } else {
                            logger.warn(`Skipping orphan tracker: ChatID ${tracker.chatId} not found in Users collection.`);
                        }
                    }

                    if (newSubscriptions.length > 0) {
                        // Use bulkWrite with upsert to be idempotent (safe to run multiple times)
                        const bulkOps = newSubscriptions.map(sub => ({
                            updateOne: {
                                filter: { user: sub.user, product: sub.product },
                                update: { $set: sub },
                                upsert: true
                            }
                        }));

                        await Subscription.bulkWrite(bulkOps, { session });
                        totalSubscriptions += newSubscriptions.length;
                    }

                    if (processedProducts % 100 === 0) {
                        logger.info(`Processed ${processedProducts} products...`);
                    }
                }

                logger.info(`Migration committed. Created ${totalSubscriptions} subscriptions from ${processedProducts} products.`);
            });

        } catch (transactionError) {
            logger.error('Transaction aborted:', transactionError);
            throw transactionError;
        } finally {
            session.endSession();
        }

    } catch (error) {
        logger.error('Migration failed:', error);
        process.exit(1);
    }

    logger.info('Migration script completed successfully.');
    process.exit(0);
};

migrate();
