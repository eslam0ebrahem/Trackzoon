import { DashboardUserService } from '../services/dashboardUserService.js';

export const getSettings = async (req, res) => {
    try {
        const settings = await DashboardUserService.getSettings();
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const updateSettings = async (req, res) => {
    try {
        const { webhookUrl } = req.body;
        const settings = await DashboardUserService.updateSettings({ webhookUrl });
        res.json(settings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const generateApiKey = async (req, res) => {
    try {
        const result = await DashboardUserService.generateApiKey();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
