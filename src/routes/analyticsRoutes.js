import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

// All analytics routes require authentication
router.use(authMiddleware);

router.get('/forecast/:asin', analyticsController.getForecast);
router.get('/volatility/:asin', analyticsController.getVolatility);
router.get('/best-day/:asin', analyticsController.getBestDay);
router.get('/stock-history/:asin', analyticsController.getStockHistory);
router.get('/deal-intelligence/:asin', analyticsController.getDealIntelligence);
router.get('/deal-opportunities', analyticsController.getDealOpportunities);
router.get('/best-drops', analyticsController.getBestDrops);
router.get('/trend-overview', analyticsController.getTrendOverview);
router.get('/top-categories', analyticsController.getTopCategories);

export default router;
