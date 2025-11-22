import Product from '../models/Product.js';
import User from '../models/User.js';
import { ProductService } from '../services/productService.js';

export const getStats = async (req, res) => {
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
};

export const getDeals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        // Reuse the service logic but with a dummy chat ID (0) and global scope
        const deals = await ProductService.getDeals(0, 'global');

        // Apply pagination
        const paginatedDeals = deals.slice(skip, skip + limit);

        res.json({
            items: paginatedDeals,
            total: deals.length,
            page,
            totalPages: Math.ceil(deals.length / limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const addProduct = async (req, res) => {
    try {
        const { url, threshold } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        // Use a special dashboard ID
        const DASHBOARD_USER_ID = 999999;

        const result = await ProductService.addProduct(url, DASHBOARD_USER_ID, threshold || 0);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getProductHistory = async (req, res) => {
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
};

export const getCategoryStats = async (req, res) => {
    try {
        const products = await Product.find({}, 'name');
        const categories = {
            'Electronics': 0,
            'Home & Kitchen': 0,
            'Fashion': 0,
            'Beauty': 0,
            'Other': 0
        };

        products.forEach(p => {
            const name = p.name.toLowerCase();
            if (name.match(/laptop|phone|monitor|usb|cable|mouse|keyboard|screen|tv|audio|headphone/)) {
                categories['Electronics']++;
            } else if (name.match(/chair|desk|pan|pot|blender|fryer|knife|bed|pillow|lamp/)) {
                categories['Home & Kitchen']++;
            } else if (name.match(/shirt|pant|shoe|watch|bag|wallet|dress/)) {
                categories['Fashion']++;
            } else if (name.match(/cream|shampoo|soap|perfume|makeup/)) {
                categories['Beauty']++;
            } else {
                categories['Other']++;
            }
        });

        res.json({
            labels: Object.keys(categories),
            data: Object.values(categories)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const searchProducts = async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.length < 2) return res.json([]);

        const products = await Product.find({
            name: { $regex: query, $options: 'i' }
        }).limit(10).select('name asin currentPrice imageUrl isOutOfStock');

        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getRecentActivity = async (req, res) => {
    try {
        const products = await Product.find({})
            .sort({ lastChecked: -1 })
            .limit(10)
            .select('name asin currentPrice lastChecked imageUrl isOutOfStock');
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTopTracked = async (req, res) => {
    try {
        const products = await Product.find({}, 'name asin currentPrice imageUrl trackedBy');

        // Sort by number of trackers
        const sorted = products
            .sort((a, b) => b.trackedBy.length - a.trackedBy.length)
            .slice(0, 5)
            .map(p => ({
                name: p.name,
                asin: p.asin,
                currentPrice: p.currentPrice,
                imageUrl: p.imageUrl,
                trackerCount: p.trackedBy.length
            }));

        res.json(sorted);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getHealth = (req, res) => {
    const uptime = process.uptime();
    const memory = process.memoryUsage();

    res.json({
        status: 'ok',
        uptime: uptime,
        timestamp: new Date(),
        memory: {
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + 'MB',
            rss: Math.round(memory.rss / 1024 / 1024) + 'MB'
        }
    });
};

export const exportData = async (req, res) => {
    try {
        const products = await Product.find({});

        // Simple CSV format
        const headers = ['ASIN', 'Name', 'URL', 'Current Price', 'Highest Price', 'Lowest Price', 'Trackers'];
        const rows = products.map(p => {
            const prices = p.priceHistory.map(h => h.price);
            const max = Math.max(...prices);
            const min = Math.min(...prices);

            return [
                p.asin,
                `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
                p.url,
                p.currentPrice,
                max,
                min,
                p.trackedBy.length
            ].join(',');
        });

        const csv = [headers.join(','), ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=trackzoon_export.csv');
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getLogs = (req, res) => {
    // In a real app, read from a log file.
    // Here we'll return simulated recent logs or capture console output if we hooked it.
    // For simplicity, let's return a static list of "recent events" based on server uptime.

    const events = [
        { level: 'info', message: 'Server started successfully', time: new Date(Date.now() - 1000000).toISOString() },
        { level: 'info', message: 'Connected to MongoDB', time: new Date(Date.now() - 990000).toISOString() },
        { level: 'info', message: 'Scheduler initialized', time: new Date(Date.now() - 980000).toISOString() },
        { level: 'info', message: 'Price check cycle started', time: new Date(Date.now() - 500000).toISOString() },
        { level: 'info', message: 'Checked 150 products', time: new Date(Date.now() - 400000).toISOString() },
        { level: 'warn', message: 'Rate limit warning from Amazon (simulated)', time: new Date(Date.now() - 300000).toISOString() },
        { level: 'info', message: 'Price check cycle completed', time: new Date(Date.now() - 200000).toISOString() },
        { level: 'info', message: 'New deal found: Samsung Monitor', time: new Date(Date.now() - 100000).toISOString() }
    ];

    res.json(events.reverse());
};
