import { ExtensionService } from '../services/extensionService.js';

export const syncProduct = async (req, res) => {
    try {
        const result = await ExtensionService.syncProduct(req.body);

        if (result.action === 'created') {
            return res.status(201).json({ status: result.action, product: result.product });
        }

        if (result.action === 'new_product') {
            return res.json({
                status: result.action,
                message: result.message,
                product: result.product
            });
        }

        return res.json({ status: result.action, product: result.product });
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ error: error.message });
    }
};
