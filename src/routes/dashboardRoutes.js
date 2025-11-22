import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';

const router = express.Router();

router.get('/stats', dashboardController.getStats);
router.get('/deals', dashboardController.getDeals);
router.post('/products', express.json(), dashboardController.addProduct);
router.get('/history/:asin', dashboardController.getProductHistory);
router.get('/stats/categories', dashboardController.getCategoryStats);
router.get('/search', dashboardController.searchProducts);
router.get('/recent', dashboardController.getRecentActivity);
router.get('/top-tracked', dashboardController.getTopTracked);
router.get('/health', dashboardController.getHealth);
router.get('/export', dashboardController.exportData);
router.get('/logs', dashboardController.getLogs);

// Management Features
router.post('/products/bulk', dashboardController.bulkImportProducts);
router.put('/products/:asin/tags', dashboardController.updateTags);
router.put('/products/:asin/target', dashboardController.updateTargetPrice);
router.put('/products/:asin/archive', dashboardController.archiveProduct);

export default router;
