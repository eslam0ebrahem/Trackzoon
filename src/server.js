import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Product from './models/Product.js';
import User from './models/User.js';
import { ProductService } from './services/productService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// API Routes

// Get System Stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalProducts = await Product.countDocuments();
        const totalUsers = await User.countDocuments();

        // Calculate total tracked items (sum of trackedBy arrays)
        const products = await Product.find({}, 'trackedBy');
        const totalTrackedItems = products.reduce((sum, p) => sum + p.trackedBy.length, 0);

        res.json({
            totalProducts,
            totalUsers,
            totalTrackedItems
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Global Deals
app.get('/api/deals', async (req, res) => {
    try {
        // Reuse the service logic but with a dummy chat ID (0) and global scope
        const deals = await ProductService.getDeals(0, 'global');

        // Limit to top 20
        res.json(deals.slice(0, 20));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get Product History
app.get('/api/history/:asin', async (req, res) => {
    try {
        const product = await Product.findOne({ asin: req.params.asin });
        if (!product) return res.status(404).json({ error: 'Product not found' });

        res.json({
            name: product.name,
            currentPrice: product.currentPrice,
            history: product.priceHistory,
            image: product.imageUrl
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export const startServer = () => {
    app.listen(PORT, () => {
        console.log(`🌐 Web Dashboard running at http://localhost:${PORT}`);
    });
};
