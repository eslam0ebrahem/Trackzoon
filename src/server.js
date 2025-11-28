import helmet from 'helmet';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dashboardRoutes from './routes/dashboardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import userRoutes from './routes/userRoutes.js';
import exportRoutes from './routes/exportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import extensionRoutes from './routes/extensionRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable CSP for now to avoid breaking inline scripts if any
}));

app.use(cors({
    origin: process.env.CORS_ORIGIN || '*', // Default to * but allow restriction via env
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key']
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Extension Routes (Must be before /api catch-all)
app.use('/api/v1/extension', extensionRoutes);

// Use Dashboard Routes
app.use('/api', dashboardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/system', systemRoutes);
app.use('/api/user', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/v1/extension', extensionRoutes);

export const startServer = (bot) => {
    if (bot) {
        app.locals.bot = bot;
    }
    app.listen(PORT, () => {
        console.log(`🌐 Web Dashboard running at http://localhost:${PORT}`);
    });
};
