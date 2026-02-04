import { DashboardService } from '../services/dashboardService.js';
import { SystemService } from '../services/systemService.js';

export const getStats = async (req, res) => {
    try {
        const stats = await DashboardService.getStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



export const getDeals = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const sort = req.query.sort || 'smart';
        const minDiscount = parseFloat(req.query.minDiscount) || 0;

        const chatId = req.query.chatId || req.headers['x-chat-id']; // Support header or query

        const result = await DashboardService.getDeals({
            page,
            limit,
            sort,
            chatId,
            minDiscount
        });

        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const addProduct = async (req, res) => {
    try {
        const { url, threshold, chatId } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const result = await DashboardService.addProduct(url, chatId, threshold || 0);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};



export const previewProduct = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const result = await DashboardService.previewProduct(url);
        res.json(result);
    } catch (error) {
        if (error.code === 'INVALID_URL') {
            return res.status(400).json({ error: error.message });
        }
        if (error.code === 'SCRAPING_ERROR') {
            return res.status(422).json({ error: error.message, details: error.userMessage });
        }
        res.status(500).json({ error: error.message });
    }
};

export const getProductHistory = async (req, res) => {
    try {
        const history = await DashboardService.getProductHistory(req.params.asin);
        if (!history) return res.status(404).json({ error: 'Product not found' });
        res.json(history);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getCategoryStats = async (req, res) => {
    try {
        const stats = await DashboardService.getCategoryStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const searchProducts = async (req, res) => {
    try {
        const query = req.query.q;
        const products = await DashboardService.searchProducts(query);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getRecentActivity = async (req, res) => {
    try {
        const products = await DashboardService.getRecentActivity();
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getTopTracked = async (req, res) => {
    try {
        const topProducts = await DashboardService.getTopTracked();
        res.json(topProducts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getHealth = async (req, res) => {
    try {
        const health = await SystemService.getHealth();
        const memory = {
            heapUsed: `${health.memory.heapUsed}MB`,
            rss: `${health.memory.rss}MB`
        };
        res.json({ ...health, memory });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const exportData = async (req, res) => {
    try {
        const csv = await DashboardService.exportCsv();
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
    const events = DashboardService.getLogs(level, search);
    res.json(events);
};

// Feature 5: Bulk Import
export const bulkImportProducts = async (req, res) => {
    try {
        const { urls } = req.body; // Expect array of URLs
        if (!urls || !Array.isArray(urls)) {
            return res.status(400).json({ error: 'Invalid input. Expected array of "urls".' });
        }
        const results = await DashboardService.bulkImportProducts(urls);
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
        const product = await DashboardService.updateTags(asin, tags);
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
        const product = await DashboardService.updateTargetPrice(asin, targetPrice);
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
        const product = await DashboardService.archiveProduct(asin, isArchived);
        res.json(product);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Feature 9: Get User Products
export const getUserProducts = async (req, res) => {
    try {
        const chatId = req.query.chatId || req.headers['x-chat-id'] || req.headers['x-telegram-id'];
        if (!chatId) return res.status(400).json({ error: 'Chat ID is required' });
        const products = await DashboardService.getUserProducts(chatId);
        res.json(products);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Feature 10: Broadcast Message
