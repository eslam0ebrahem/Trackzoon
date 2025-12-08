import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';
import { priceCheckQueue } from '../src/queue/priceQueue.js';

const debug = async () => {
    try {
        await connectDB();
        console.log('✅ Connected to MongoDB');

        const now = new Date();
        const dueCount = await Product.countDocuments({ nextCheck: { $lte: now } });
        const totalCount = await Product.countDocuments();

        console.log(`📊 Database State:`);
        console.log(`- Total Products: ${totalCount}`);
        console.log(`- Due for Check: ${dueCount}`);

        const waiting = await priceCheckQueue.getWaitingCount();
        const active = await priceCheckQueue.getActiveCount();
        const failed = await priceCheckQueue.getFailedCount();
        const delayed = await priceCheckQueue.getDelayedCount();

        console.log(`\n📊 Queue State:`);
        console.log(`- Waiting: ${waiting}`);
        console.log(`- Active: ${active}`);
        console.log(`- Failed: ${failed}`);
        console.log(`- Delayed: ${delayed}`);

        if (failed > 0) {
            const failedJobs = await priceCheckQueue.getFailed(0, 5);
            console.log('\n❌ Recent Failed Jobs:');
            failedJobs.forEach(job => {
                console.log(`- ID: ${job.id}, Reason: ${job.failedReason}`);
            });
        }

    } catch (err) {
        console.error('Debug failed:', err);
    } finally {
        await priceCheckQueue.close();
        process.exit(0);
    }
};

debug();
