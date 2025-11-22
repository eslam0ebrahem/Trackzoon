import express from 'express';
import * as analyticsController from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/forecast/:asin', analyticsController.getForecast);
router.get('/volatility/:asin', analyticsController.getVolatility);
router.get('/best-day/:asin', analyticsController.getBestDay);
router.get('/stock-history/:asin', analyticsController.getStockHistory);

export default router;
