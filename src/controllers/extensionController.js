import { ExtensionService } from '../services/extensionService.js';

const getStatusCode = (error, fallback = 500) => error?.statusCode || fallback;

export const syncProduct = async (req, res) => {
    const startedAt = Date.now();
    const asin = req.body?.asin ? String(req.body.asin).trim().toUpperCase() : null;
    try {
        const result = await ExtensionService.syncProduct(req.body);
        await ExtensionService.recordSyncMetric({
            source: 'single',
            status: 'success',
            action: result.action,
            asin: result.product?.asin || asin,
            durationMs: Date.now() - startedAt,
            aiVerified: !!result.meta?.aiVerified,
            aiCorrected: !!result.meta?.aiCorrected,
            availabilityReason: result.meta?.availabilityReason || null
        });

        if (result.action === 'created') {
            return res.status(201).json({ status: result.action, product: result.product, meta: result.meta || {} });
        }

        if (result.action === 'new_product') {
            return res.json({
                status: result.action,
                message: result.message,
                product: result.product,
                meta: result.meta || {}
            });
        }

        return res.json({ status: result.action, product: result.product, meta: result.meta || {} });
    } catch (error) {
        await ExtensionService.recordSyncMetric({
            source: 'single',
            status: 'error',
            action: 'error',
            asin,
            durationMs: Date.now() - startedAt,
            error: error.message
        });
        const status = getStatusCode(error);
        res.status(status).json({ error: error.message });
    }
};

export const syncProductsBatch = async (req, res) => {
    try {
        const { items, continueOnError, limit } = req.body || {};
        const result = await ExtensionService.syncProductsBatch(items, { continueOnError, limit });
        res.json(result);
    } catch (error) {
        const status = getStatusCode(error);
        res.status(status).json({ error: error.message });
    }
};

export const getStatus = async (req, res) => {
    try {
        const { asin } = req.query;
        const result = await ExtensionService.getStatus(asin);
        return res.json(result);
    } catch (error) {
        const status = getStatusCode(error);
        res.status(status).json({ error: error.message });
    }
};

export const getHealth = async (req, res) => {
    try {
        const hours = Number(req.query?.hours) || 24;
        const result = await ExtensionService.getSyncHealth(hours);
        return res.json(result);
    } catch (error) {
        const status = getStatusCode(error);
        res.status(status).json({ error: error.message });
    }
};
