import express from 'express';
import * as userController from '../controllers/userController.js';

const router = express.Router();

router.get('/settings', userController.getSettings);
router.put('/settings', userController.updateSettings);
router.post('/apikey', userController.generateApiKey);

export default router;
