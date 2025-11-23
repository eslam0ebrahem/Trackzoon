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
        const sort = req.query.sort || 'smart';

        let query = { isOutOfStock: false };
        let sortOptions = {};

        // Smart Sorting using new DB fields
        if (sort === 'smart') {
            // Sort by biggest recent drops first
            sortOptions = { 'lastPriceChange.percent': 1, 'stats.min': 1 };
            // Note: percent is negative for drops, so ascending (1) puts -50% before -10%
        } else if (sort === 'date') {
            sortOptions = { lastChecked: -1 };
        } else if (sort === 'discount') {
            sortOptions = { 'lastPriceChange.percent': 1 };
        }

        const deals = await Product.find(query)
            .sort(sortOptions)
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments(query);

        // Transform for frontend (keep existing structure but use pre-calc data)
        const items = deals.map(p => {
            // Calculate deal score on the fly or use stored if available
            // For now, mapping to expected format
            return {
                product: p,
                currentPrice: p.currentPrice,
                oldPrice: p.lastPriceChange?.oldPrice || p.currentPrice,
                priceDiff: p.lastPriceChange?.diff || 0,
                percentChange: p.lastPriceChange?.percent || 0,
                stats30d: p.stats, // Use pre-calc stats
                dealScore: 0 // TODO: Store dealScore in DB too
            };
        });

        res.json({
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit)
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

export const previewProduct = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const result = await ProductService.previewProduct(url);
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
        const stats = await Product.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } }
        ]);

        const labels = [];
        const data = [];

        stats.forEach(s => {
            if (s._id) {
                labels.push(s._id);
                data.push(s.count);
            }
        });

        res.json({ labels, data });
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

    const { level, search } = req.query;

    let events = [
        { level: 'info', message: 'Server started successfully', time: new Date(Date.now() - 1000000).toISOString() },
        { level: 'info', message: 'Connected to MongoDB', time: new Date(Date.now() - 990000).toISOString() },
        { level: 'info', message: 'Scheduler initialized', time: new Date(Date.now() - 980000).toISOString() },
        { level: 'info', message: 'Price check cycle started', time: new Date(Date.now() - 500000).toISOString() },
        { level: 'info', message: 'Checked 150 products', time: new Date(Date.now() - 400000).toISOString() },
        { level: 'warn', message: 'Rate limit warning from Amazon (simulated)', time: new Date(Date.now() - 300000).toISOString() },
        { level: 'error', message: 'Failed to scrape product B08XYZ123', time: new Date(Date.now() - 250000).toISOString() },
        { level: 'info', message: 'Price check cycle completed', time: new Date(Date.now() - 200000).toISOString() },
        { level: 'info', message: 'New deal found: Samsung Monitor', time: new Date(Date.now() - 100000).toISOString() }
    ];

    // Filter by level
    if (level && level !== 'all') {
        events = events.filter(e => e.level === level);
    }

    // Filter by search query
    if (search) {
        const q = search.toLowerCase();
        events = events.filter(e => e.message.toLowerCase().includes(q));
    }

    res.json(events.reverse());
};

// Feature 5: Bulk Import
export const bulkImportProducts = async (req, res) => {
    try {
        const { urls } = req.body; // Expect array of URLs
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'Invalid input. Expected array of "urls".' });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        // Process in chunks to avoid overwhelming
        for (const url of urls) {
            try {
                await ProductService.addProduct(url, '999999'); // Dashboard User ID
                results.success++;
            } catch (e) {
                results.failed++;
                results.errors.push({ url, error: e.message });
            }
        }

        res.json(results);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Feature 6: Update Tags
export const updateTags = async (req, res) => {
    try {
        const { asin } = req.params;
        const { tags } = req.body; // Array of strings

        const product = await Product.findOneAndUpdate(
            { asin },
            { $set: { tags } },
            { new: true }
        );

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Feature 7: Update Target Price
export const updateTargetPrice = async (req, res) => {
    try {
        const { asin } = req.params;
        const { targetPrice } = req.body;

        // Update global threshold
        const product = await Product.findOneAndUpdate(
            { asin },
            { $set: { thresholdPrice: targetPrice } },
            { new: true }
        );

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Feature 8: Archive Product
export const archiveProduct = async (req, res) => {
    try {
        const { asin } = req.params;
        const { isArchived } = req.body;

        const product = await Product.findOneAndUpdate(
            { asin },
            { $set: { isArchived } },
            { new: true }
        );

        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
