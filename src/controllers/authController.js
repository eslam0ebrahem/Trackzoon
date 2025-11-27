import { generateToken } from '../middleware/authMiddleware.js';

export const login = async (req, res) => {
    try {
        const { password } = req.body;

        // Simple admin password check from environment variables
        // Default to 'admin' if not set (WARNED in logs)
        const adminPassword = process.env.ADMIN_PASSWORD || 'admin';

        if (password === adminPassword) {
            const token = generateToken({ role: 'admin' });
            return res.json({ token });
        }

        return res.status(401).json({ error: 'Invalid password' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
