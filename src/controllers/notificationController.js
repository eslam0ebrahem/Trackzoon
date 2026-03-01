import User from '../models/User.js';
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const notifications = await Notification.find({ user: user._id })
            .sort({ createdAt: -1 })
            .limit(50); // Fetch top 50 recent notifications
        res.json(notifications);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const clearNotifications = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Delete all notifications for the user to clear the panel
        await Notification.deleteMany({ user: user._id });
        res.json({ success: true, message: 'Notifications cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
