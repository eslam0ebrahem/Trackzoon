import 'dotenv/config';
import connectDB from './config/db.js';
import { createWorker } from './queue/priceQueue.js';
import { logger } from './utils/logger.js';
import initializeBot from './core/bot.js';
import commands from './config/commands.js';

// The worker process needs DB connection and potentially Bot instance if notifications are sent directly
// PriceTrackerService sends notifications via NotificationService -> bot.telegram.sendMessage
// So we need a bot instance, but maybe not launched (no polling), just initialized for API access.

const startWorker = async () => {
    logger.info('🛠️ Starting Worker Process...');

    try {
        await connectDB();
        logger.info('✅ Worker connected to MongoDB');

        // Initialize Bot (for sending messages only)
        const bot = initializeBot(commands);

        // Start the BullMQ Worker
        const worker = createWorker(bot);

        logger.info('🚀 Worker is running and waiting for jobs...');

        // Graceful Shutdown
        const shutdown = async (signal) => {
            logger.info(`Received ${signal}. Shutting down worker...`);
            await worker.close();
            process.exit(0);
        };

        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));

    } catch (error) {
        logger.error('Failed to start worker:', error);
        process.exit(1);
    }
};

startWorker();
