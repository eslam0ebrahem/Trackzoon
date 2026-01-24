import mongoose from 'mongoose';
import Product from '../models/Product.js';
import PricePoint from '../models/PricePoint.js';
import { logger } from '../utils/logger.js';
import { calculateDealScore, calculateVolatility, predictPriceTrend, calculatePriceStats } from '../utils/priceUtils.js';
import { aiService } from '../services/aiService.js';

export const syncProduct = async (req, res) => {
    try {
        const { asin, url, name, price, imageUrl, isOutOfStock } = req.body;

        if (!asin || !url || price === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // AI VERIFICATION FALLBACK
        // If extension reports OutOfStock, double check with AI to be sure (and recover price if possible)
        if (isOutOfStock || price === 0) {
            logger.info(`🕵️ Extension flagged ${asin} as OOS. Verifying with AI...`);
            const aiResult = await aiService.checkProductAvailability(url);

            if (aiResult && aiResult.isAvailable && aiResult.price) {
                logger.info(`✅ AI Correction: Item IS available at ${aiResult.price} EGP`);
                // Override extension data
                price = aiResult.price;
                isOutOfStock = false;
            } else if (aiResult && !aiResult.isAvailable) {
                logger.debug(`✅ AI Confirmed OOS: ${aiResult.reason}`);
            }
        }

        logger.info(`📥 Extension Sync: ${asin} - ${price} EGP (OOS: ${isOutOfStock})`);

        let product = await Product.findOne({ asin });

        if (product) {
            // UPDATE EXISTING
            const oldPrice = product.currentPrice;
            const priceChanged = oldPrice !== price;

            product.currentPrice = price;
            product.isOutOfStock = isOutOfStock;
            product.lastChecked = new Date();
            product.lastUpdated = new Date(); // Always update this to show it's fresh

            // Update metadata if provided and missing
            if (!product.imageUrl && imageUrl) product.imageUrl = imageUrl;
            if (!product.name && name) product.name = name;

            // Add to Price History
            if (priceChanged || product.priceHistory.length === 0) {
                product.priceHistory.push({ price, date: new Date() });

                // Save PricePoint
                await PricePoint.create({
                    product: product._id,
                    asin: product.asin,
                    price: price,
                    date: new Date()
                });

                // Update stats
                if (priceChanged) {
                    product.lastPriceChange = {
                        date: new Date(),
                        oldPrice,
                        newPrice: price,
                        diff: price - oldPrice,
                        percent: ((price - oldPrice) / oldPrice) * 100
                    };
                }
            }

            // Recalculate Smart Metrics (simplified version of what PriceTrackerService does)
            const stats = calculatePriceStats(product.priceHistory);
            if (stats) {
                product.stats = {
                    min: stats.min,
                    max: stats.max,
                    avg: stats.average,
                    volatility: product.stats.volatility // Keep existing or recalc if needed
                };

                // Recalc volatility occasionally? Let's just do it now, it's cheap
                const vol = calculateVolatility(product.priceHistory);
                product.volatilityScore = vol.score;
                product.stats.volatility = vol.score;

                // Recalc Smart Score
                const trend = predictPriceTrend(product.priceHistory);
                product.smartScore = calculateDealScore(price, stats, vol.score, isOutOfStock, trend);
            }

            await product.save();
            logger.info(`✅ Updated product ${asin} via extension`);
            return res.json({ status: 'updated', product: { asin, price, smartScore: product.smartScore } });

        } else {
            // CREATE NEW
            // Check if manual creation is requested
            const { create } = req.body;

            if (!create) {
                // Return 'new_product' status so frontend can prompt user
                logger.info(`🆕 New product detected ${asin}, waiting for user confirmation`);
                return res.json({
                    status: 'new_product',
                    message: 'Product not tracked. User confirmation required.',
                    product: { asin, name, price }
                });
            }

            // If create=true, proceed with creation
            product = new Product({
                asin,
                url,
                name,
                imageUrl,
                currentPrice: price,
                isOutOfStock,
                priceHistory: [{ price, date: new Date() }],
                lastChecked: new Date(),
                lastUpdated: new Date()
            });

            // Initial stats
            product.stats = { min: price, max: price, avg: price, volatility: 0 };
            product.smartScore = 50; // Neutral start

            await product.save();

            // Save initial PricePoint
            await PricePoint.create({
                product: product._id,
                asin: product.asin,
                price: price,
                date: new Date()
            });

            logger.info(`✨ Created new product ${asin} via extension`);
            return res.status(201).json({
                status: 'created',
                product: { asin, price }
            });
        }

    } catch (error) {
        logger.error(`❌ Extension Sync Error: ${error.message}`);
        res.status(500).json({ error: error.message });
    }
};
