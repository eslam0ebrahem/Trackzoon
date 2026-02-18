import express from 'express';
import { syncProduct, syncProductsBatch, getStatus, getHealth } from '../controllers/extensionController.js';
import { extensionAuth } from '../middleware/extensionAuth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(extensionAuth);

router.post('/sync', syncProduct);
router.post('/sync/batch', syncProductsBatch);
router.get('/status', getStatus);
router.get('/health', getHealth);

export default router;
