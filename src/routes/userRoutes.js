import express from 'express';
import * as userController from '../controllers/userController.js';
import * as notificationController from '../controllers/notificationController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const router = express.Router();

// All user routes require authentication
router.use(authMiddleware);

router.get('/settings', userController.getSettings);
router.put('/settings', express.json(), userController.updateSettings);
router.post('/apikey', userController.generateApiKey);

// GET /me - Get current user info with unread notification count
router.get('/me', async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const unreadCount = await Notification.countDocuments({ user: user._id, isRead: false });

        res.json({
            user: {
                telegramId: user.telegramId,
                firstName: user.firstName,
                username: user.username,
                settings: user.settings
            },
            isAdmin: user.isAdmin || false,
            unreadNotifications: unreadCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Notification endpoints
router.get('/notifications', notificationController.getNotifications);
router.get('/notifications/unread-count', notificationController.getUnreadCount);
router.put('/notifications/:id/read', notificationController.markAsRead);
router.put('/notifications/read-all', notificationController.markAsRead);
router.post('/notifications/clear', notificationController.clearNotifications);

export default router;
