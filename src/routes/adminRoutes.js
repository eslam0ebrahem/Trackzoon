import express from 'express';
import User from '../models/User.js';
import Product from '../models/Product.js';
import SystemMetric from '../models/SystemMetric.js';
import Subscription from '../models/Subscription.js';
import { PriceTrackerService } from '../services/priceTrackerService.js';
import { sendMessage } from '../utils/messageHelper.js';

import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// Middleware to check admin status
const checkAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    next();
};

router.use(authMiddleware);
router.use(checkAdmin);

// GET /stats - System Overview
router.get('/stats', async (req, res) => {
    try {
        const [userCount, productCount, activeAlerts] = await Promise.all([
            User.countDocuments(),
            Product.countDocuments(),
            Product.countDocuments(),
            Subscription.countDocuments() // Exact count of active subscriptions
        ]);

        // Get recent system metrics
        const metrics = await SystemMetric.find().sort({ timestamp: -1 }).limit(1);
        const lastScrape = metrics[0]?.data || {};

        res.json({
            users: userCount,
            products: productCount,
            activeAlerts,
            system: {
                uptime: process.uptime(),
                memory: process.memoryUsage(),
                lastScrape
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /scrape-all - Force Scrape
router.post('/scrape-all', async (req, res) => {
    try {
        // We need access to the bot instance. 
        // Ideally, PriceTrackerService should be a singleton or accessible.
        // For now, we'll instantiate a new service with a mock bot if needed, 
        // OR better, import the initialized service if we refactor.
        // Given the current structure, we might need to pass the bot instance to routes.
        // For this MVP, let's assume we can just call the static method or new instance if it doesn't strictly depend on bot for scraping (it does for notifying).

        // WORKAROUND: We can't easily get the running bot instance here without dependency injection.
        // However, checkAllPrices mainly updates DB. Notifications might fail if bot is not passed.
        // Let's try to import the bot from index.js? No, circular dependency.

        // Solution: We will just trigger the scraping logic. Notifications might be skipped or fail gracefully.
        const service = new PriceTrackerService(null); // Pass null as bot

        // We need to mock the bot for notifyUser to not crash
        service.bot = {
            telegram: {
                sendMessage: () => Promise.resolve(),
                sendPhoto: () => Promise.resolve()
            }
        };

        const result = await service.checkAllPrices(true); // Force check
        res.json({ message: 'Scrape started', result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Alias for check-prices (used by System Dashboard)
router.post('/check-prices', async (req, res) => {
    try {
        const service = new PriceTrackerService(null);
        service.bot = { telegram: { sendMessage: () => Promise.resolve(), sendPhoto: () => Promise.resolve() } };
        const result = await service.checkAllPrices(true);
        res.json({ message: 'Price check started', result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /broadcast - Send Message to All
router.post('/broadcast', async (req, res) => {
    try {
        const { message } = req.body;
        if (!message) return res.status(400).json({ error: 'Message required' });

        const users = await User.find({ 'settings.notifications': true });
        let sent = 0;
        let failed = 0;

        // We need the real bot instance here to send messages.
        // Since we can't easily get it, we'll use the standard Telegram API directly via fetch/axios if needed,
        // OR we rely on the service workaround.
        // Let's use the service workaround but we need the token.

        // Actually, let's just use the helper `sendMessage` but it needs `bot` instance.
        // Alternative: Use `axios` to hit Telegram API directly using env var.

        const token = process.env.TELEGRAM_BOT_TOKEN;
        if (!token) return res.status(500).json({ error: 'Bot token missing' });

        const { default: axios } = await import('axios'); // Dynamic import

        for (const user of users) {
            try {
                await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
                    chat_id: user.telegramId,
                    text: message,
                    parse_mode: 'Markdown'
                });
                sent++;
                await new Promise(r => setTimeout(r, 50)); // Rate limit
            } catch (e) {
                failed++;
                console.error(`Failed to send to ${user.telegramId}`, e.message);
            }
        }

        res.json({ sent, failed });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
