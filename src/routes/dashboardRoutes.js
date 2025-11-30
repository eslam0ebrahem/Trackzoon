import express from 'express';
import * as dashboardController from '../controllers/dashboardController.js';
import * as authController from '../controllers/authController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Public Routes
router.post('/login', express.json(), validate(schemas.login), authController.login);
router.get('/health', dashboardController.getHealth);
router.get('/user/me', authMiddleware, (req, res) => {
    res.json({ user: req.user, isAdmin: req.user.role === 'admin' });
});

// Protected Routes (Read-Only)
router.use(authMiddleware); // Apply auth to all subsequent routes

router.get('/stats', dashboardController.getStats);
router.get('/deals', dashboardController.getDeals);
router.get('/history/:asin', dashboardController.getProductHistory);
router.get('/stats/categories', dashboardController.getCategoryStats);
router.get('/search', dashboardController.searchProducts);
router.get('/recent', dashboardController.getRecentActivity);
router.get('/top-tracked', dashboardController.getTopTracked);
router.get('/export', dashboardController.exportData);
router.get('/logs', dashboardController.getLogs);
router.get('/products/user', dashboardController.getUserProducts);

// Protected Routes (Write Access)
router.post('/products', express.json(), validate(schemas.addProduct), dashboardController.addProduct);
router.post('/products/preview', express.json(), validate(schemas.previewProduct), dashboardController.previewProduct);

// Management Features
router.post('/products/bulk', validate(schemas.bulkImport), dashboardController.bulkImportProducts);
router.put('/products/:asin/tags', validate(schemas.updateTags), dashboardController.updateTags);
router.put('/products/:asin/target', validate(schemas.updateTarget), dashboardController.updateTargetPrice);
router.put('/products/:asin/archive', validate(schemas.archive), dashboardController.archiveProduct);

export default router;
