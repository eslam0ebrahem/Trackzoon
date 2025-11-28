import express from 'express';
import { syncProduct } from '../controllers/extensionController.js';
import { extensionAuth } from '../middleware/extensionAuth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(extensionAuth);

router.post('/sync', syncProduct);

export default router;
