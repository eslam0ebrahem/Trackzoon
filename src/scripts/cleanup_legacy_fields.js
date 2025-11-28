import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import User from '../models/User.js';
import connectDB from '../config/db.js';
import { logger } from '../utils/logger.js';

const cleanup = async () => {
    try {
        await connectDB();
        logger.info('Starting cleanup of legacy fields...');

        // 1. Remove trackedBy from Products
        const productResult = await Product.updateMany(
            { 'trackedBy.0': { $exists: true } },
            { $unset: { trackedBy: "" } }
        );
        logger.info(`Removed trackedBy from ${productResult.modifiedCount} products.`);

        // 2. Remove products from Users
        const userResult = await User.updateMany(
            { 'products.0': { $exists: true } },
            { $unset: { products: "" } }
        );
        logger.info(`Removed products array from ${userResult.modifiedCount} users.`);

        logger.info('Cleanup completed successfully.');
        process.exit(0);
    } catch (error) {
        logger.error('Cleanup failed:', error);
        process.exit(1);
    }
};

cleanup();
