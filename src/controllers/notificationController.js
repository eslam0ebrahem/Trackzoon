import User from '../models/User.js';
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
        const skip = (page - 1) * limit;

        const [notifications, total, unreadCount] = await Promise.all([
            Notification.find({ user: user._id })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit),
            Notification.countDocuments({ user: user._id }),
            Notification.countDocuments({ user: user._id, isRead: false })
        ]);

        res.json({
            notifications,
            unreadCount,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const markAsRead = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const { id } = req.params;

        if (id) {
            // Mark single notification as read
            const notification = await Notification.findOneAndUpdate(
                { _id: id, user: user._id },
                { $set: { isRead: true } },
                { new: true }
            );
            if (!notification) return res.status(404).json({ error: 'Notification not found' });
            return res.json({ success: true, notification });
        }

        // Mark all as read
        const result = await Notification.updateMany(
            { user: user._id, isRead: false },
            { $set: { isRead: true } }
        );
        res.json({ success: true, updated: result.modifiedCount });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const clearNotifications = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        // Only delete read notifications, mark unread as read first
        const { force } = req.query;
        if (force === 'true') {
            await Notification.deleteMany({ user: user._id });
            return res.json({ success: true, message: 'All notifications deleted' });
        }

        // Default: delete only read notifications
        const result = await Notification.deleteMany({ user: user._id, isRead: true });
        res.json({ success: true, deleted: result.deletedCount, message: 'Read notifications cleared' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const user = await User.findOne({ telegramId: req.user.telegramId });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const count = await Notification.countDocuments({ user: user._id, isRead: false });
        res.json({ unreadCount: count });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
