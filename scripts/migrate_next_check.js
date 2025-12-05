import 'dotenv/config';
import connectDB from '../src/config/db.js';
import Product from '../src/models/Product.js';
import { applyJitter } from '../src/utils/priceUtils.js';

const migrate = async () => {
    try {
        await connectDB();
        console.log('Connected to DB');

        const products = await Product.find({ nextCheck: { $exists: false } });
        console.log(`Found ${products.length} products to migrate`);

        let updated = 0;
        for (const product of products) {
            const baseInterval = product.checkInterval || 60;
            const intervalWithJitter = applyJitter(baseInterval);
            // Default to now if lastChecked is missing, to ensure it gets picked up
            const lastChecked = product.lastChecked ? new Date(product.lastChecked) : new Date();
            const nextCheck = new Date(lastChecked.getTime() + intervalWithJitter * 60000);

            product.nextCheck = nextCheck;
            await product.save();
            updated++;
            if (updated % 10 === 0) process.stdout.write('.');
        }

        console.log(`\nMigration complete. Updated ${updated} products.`);
        process.exit(0);

    } catch (error) {
        console.error('Migration failed:', error);
        process.exit(1);
    }
};

migrate();
