import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import { ProductService } from '../services/productService.js';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import Product from '../models/Product.js';
import { logger } from '../utils/logger.js';

const verify = async () => {
    try {
        await connectDB();
        logger.info('Starting verification...');

        // 1. Find or Create a Test User
        let user = await User.findOne({ telegramId: 'TEST_USER_123' });
        if (!user) {
            user = await User.create({
                telegramId: 'TEST_USER_123',
                firstName: 'Test',
                username: 'testuser'
            });
            logger.info('Created test user');
        } else {
            logger.info('Found test user');
        }

        const testUrl = 'https://www.amazon.eg/dp/B098765432'; // Fake ASIN B098765432
        // We need to mock resolveAmazonUrl or use a real one?
        // ProductService uses resolveAmazonUrl.
        // If I use a fake URL, resolveAmazonUrl might fail if it validates domain.
        // Let's use a real-ish URL but maybe mock the resolver if possible?
        // Or just rely on the fact that I can't easily mock imports in this script without complexity.
        // I'll use a real URL structure.

        // Actually, ProductService calls resolveAmazonUrl.
        // If I want to test without external calls, I should mock it.
        // But for this script, let's try to use a real ASIN if possible, or just rely on error handling.
        // Wait, I can just insert a product manually and then test addProduct logic if I could skip scraping.
        // But addProduct does scraping.

        // Let's try to use a real ASIN that exists in DB or just handle the error.
        // Better: Test getUserProducts and removeProduct on existing data first?
        // Or just create a Subscription manually and see if getUserProducts returns it correctly.

        // Test 1: Manual Subscription Creation & Retrieval
        logger.info('Test 1: Manual Subscription Creation & Retrieval');
        const product = await Product.findOne({}); // Get any product
        if (!product) {
            logger.warn('No products in DB to test with.');
            process.exit(0);
        }

        // Create subscription
        await Subscription.deleteMany({ user: user._id, product: product._id });
        await Subscription.create({
            user: user._id,
            product: product._id,
            targetPrice: 1000
        });
        logger.info(`Created subscription for Product ${product.asin}`);

        // Fetch using ProductService
        const userProducts = await ProductService.getUserProducts(user.telegramId);
        const fetchedProduct = userProducts.find(p => p.asin === product.asin);

        if (fetchedProduct) {
            logger.info('✅ ProductService.getUserProducts returned the product.');
            if (fetchedProduct.currentUserSubscription) {
                logger.info('✅ currentUserSubscription is attached.');
            } else {
                logger.error('❌ currentUserSubscription is MISSING.');
            }

            if (fetchedProduct.trackedBy && Array.isArray(fetchedProduct.trackedBy)) {
                logger.info('✅ trackedBy mock is present.');
                logger.info(`Mock data: ${JSON.stringify(fetchedProduct.trackedBy)}`);
            } else {
                logger.error('❌ trackedBy mock is MISSING.');
            }
        } else {
            logger.error('❌ ProductService.getUserProducts DID NOT return the product.');
        }

        // Test 2: Remove Product
        logger.info('Test 2: Remove Product');
        await ProductService.removeProduct(product.asin, user.telegramId);

        const subAfterRemove = await Subscription.findOne({ user: user._id, product: product._id });
        if (!subAfterRemove) {
            logger.info('✅ Subscription deleted successfully.');
        } else {
            logger.error('❌ Subscription STILL EXISTS.');
        }

        // Cleanup
        await User.deleteOne({ telegramId: 'TEST_USER_123' });
        logger.info('Cleanup complete.');

    } catch (error) {
        logger.error('Verification failed:', error);
    } finally {
        process.exit(0);
    }
};

verify();
