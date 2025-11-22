import express from 'express';
import * as exportController from '../controllers/exportController.js';

const router = express.Router();

router.get('/pdf', exportController.exportPdf);
router.get('/rss', exportController.getRssFeed);

export default router;
