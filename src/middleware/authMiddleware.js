import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

import User from '../models/User.js';

export const authMiddleware = async (req, res, next) => {
    // Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        if (token.startsWith('tk_')) {
            const user = await User.findOne({ apiKey: token });
            if (!user) {
                return res.status(401).json({ error: 'Invalid API key.' });
            }
            req.user = {
                telegramId: user.telegramId,
                role: user.isAdmin ? 'admin' : 'user',
                ...user.toObject()
            };
        } else {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.user = decoded;
        }
        next();
    } catch (error) {
        res.status(401).json({ error: 'Invalid token.' });
    }
};

export const generateToken = (payload) => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
};
