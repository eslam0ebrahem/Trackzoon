import express from 'express';
import * as userController from '../controllers/userController.js';
import User from '../models/User.js';

const router = express.Router();

router.get('/settings', userController.getSettings);
router.put('/settings', userController.updateSettings);
router.post('/apikey', userController.generateApiKey);

import { authMiddleware } from '../middleware/authMiddleware.js';

// GET /me - Get current user info
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        res.json({
            user: {
                telegramId: user.telegramId,
                firstName: user.firstName,
                username: user.username,
                settings: user.settings
            },
            isAdmin: user.isAdmin || false
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
