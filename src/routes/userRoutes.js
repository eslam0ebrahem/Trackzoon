import express from 'express';
import * as userController from '../controllers/userController.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/settings', userController.getSettings);
router.put('/settings', userController.updateSettings);
router.post('/apikey', userController.generateApiKey);

// GET /me - Get current user info
router.get('/me', async (req, res) => {
    try {
        const telegramId = req.headers['x-telegram-id'];
        if (!telegramId) return res.status(401).json({ error: 'Unauthorized' });

        const user = await User.findOne({ telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            telegramId: user.telegramId,
            firstName: user.firstName,
            username: user.username,
            isAdmin: user.isAdmin || false,
            settings: user.settings
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
