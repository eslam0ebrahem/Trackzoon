import express from 'express';
import * as systemController from '../controllers/systemController.js';

const router = express.Router();

router.get('/health', systemController.getHealth);
router.get('/db-stats', systemController.getDbStats);
router.get('/queue', systemController.getQueueStatus);
router.get('/metrics', systemController.getMetricsHistory);

export default router;
