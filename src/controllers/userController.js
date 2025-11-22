import User from '../models/User.js';
import crypto from 'crypto';

export const getSettings = async (req, res) => {
    try {
        // Mock user ID for dashboard (in real app, get from session/auth)
        const DASHBOARD_USER_ID = '999999';
        let user = await User.findOne({ telegramId: DASHBOARD_USER_ID });

        if (!user) {
            // Create dummy user for dashboard settings if not exists
            user = await User.create({ telegramId: DASHBOARD_USER_ID, firstName: 'Dashboard Admin' });
        }

        res.json({
            webhookUrl: user.webhookUrl,
            apiKey: user.apiKey
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const DASHBOARD_USER_ID = '999999';
        const { webhookUrl } = req.body;

        const user = await User.findOneAndUpdate(
            { telegramId: DASHBOARD_USER_ID },
            { $set: { webhookUrl } },
            { new: true, upsert: true }
        );

        res.json({ webhookUrl: user.webhookUrl });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const generateApiKey = async (req, res) => {
    try {
        const DASHBOARD_USER_ID = '999999';
        const apiKey = 'tk_' + crypto.randomBytes(16).toString('hex');

        const user = await User.findOneAndUpdate(
            { telegramId: DASHBOARD_USER_ID },
            { $set: { apiKey } },
            { new: true, upsert: true }
        );

        res.json({ apiKey: user.apiKey });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
