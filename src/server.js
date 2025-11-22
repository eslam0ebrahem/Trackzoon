import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dashboardRoutes from './routes/dashboardRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Use Dashboard Routes
app.use('/api', dashboardRoutes);

export const startServer = () => {
    app.listen(PORT, () => {
        console.log(`🌐 Web Dashboard running at http://localhost:${PORT}`);
    });
};
