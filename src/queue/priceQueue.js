import { Queue, Worker } from 'bullmq';
import { logger } from '../utils/logger.js';
import { PriceTrackerService } from '../services/priceTrackerService.js';
import cache from '../config/cache.js'; // Use existing Redis connection config if possible, but BullMQ needs connection details

// BullMQ connection settings
// We should reuse the existing REDIS_URL from env
const connection = {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    // BullMQ requires some specific options sometimes, but usually URL is enough if ioredis is used internally
};

// Create the Queue (Producer)
export const priceCheckQueue = new Queue('price-check-queue', {
    connection: {
        url: process.env.REDIS_URL || 'redis://localhost:6379'
    },
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 500,     // Keep last 500 failed jobs for debugging
    },
});

// Worker Factory
export const createWorker = (bot) => {
    const priceTracker = new PriceTrackerService(bot);

    const worker = new Worker('price-check-queue', async (job) => {
        const { product } = job.data;
        // logger.info(`Here Processing job ${job.id} for product ${product.asin}`);

        try {
            // We pass the product plain object, checkPrice might expect a Mongoose document?
            // PriceTrackerService.checkPrice expects a Mongoose Document because it calls .save() on it.
            // BullMQ serializes to JSON. We must Re-fetch or Hydrate the document.
            // Efficient Approach: Pass ID, fetch fresh from DB (safer for distributed systems anyway).
            const { Product } = await import('../models/index.js'); // Assuming index.js exports models or direct import
            const ProductModel = (await import('../models/Product.js')).default;

            const productDoc = await ProductModel.findById(product._id);
            if (!productDoc) {
                throw new Error(`Product ${product._id} not found`);
            }

            const result = await priceTracker.checkPrice(productDoc);
            return result;

        } catch (error) {
            logger.error(`Job ${job.id} failed: ${error.message}`);
            throw error;
        }
    }, {
        connection: {
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        },
        concurrency: 5, // Replace p-limit with this!
        limiter: {
            max: 10,      // Max 10 jobs
            duration: 1000, // Per 1 second (Rate limiting)
        }
    });

    worker.on('completed', (job) => {
        // logger.info(`Job ${job.id} completed!`);
    });

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job.id} failed with ${err.message}`);
    });

    return worker;
};
