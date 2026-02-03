import { logger } from '../utils/logger.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';
import { sendWebhook } from './webhookService.js';
import { generatePriceHistoryChart } from '../utils/chartGenerator.js';
import { calculatePriceStats } from '../utils/priceUtils.js';
import { DASHBOARD_USER_ID } from '../config/constants.js';

export class NotificationService {
    constructor(bot) {
        this.bot = bot;
    }

    async sendPriceAlert(tracker, product, oldPrice, newPrice) {
        if (!tracker || !tracker.chatId || String(tracker.chatId) === DASHBOARD_USER_ID) return; // Skip dashboard dummy user
        const emoji = product.priceHistory.length === 0 ? '🆕' : '📉';
        try {
            // Enhanced Message Building
            const stats30d = product.priceHistory ? calculatePriceStats(product.priceHistory, 30) : null;
            const avgPrice = stats30d ? stats30d.average : 0;
            const maxPrice = stats30d ? stats30d.max : 0;
            const isAllTimeLow = stats30d && newPrice <= stats30d.min;

            const savings = oldPrice - newPrice;
            const percentDrop = oldPrice > 0 ? ((savings / oldPrice) * 100).toFixed(1) : '0.0';

            let header = '📉 *Price Drop Alert\\!*';
            if (isAllTimeLow) header = '🔥 *ALL TIME LOW\\!*';
            else if (Number(percentDrop) > 20) header = '⚡ *HUGE DROP\\!*';

            // AI Analysis (Responsive Fallback)
            let aiInsight = '';
            try {
                // Determine context for AI
                await import('./aiService.js').then(async ({ aiService }) => {
                    const analysis = await aiService.analyzeDeal({
                        name: product.name,
                        currentPrice: newPrice,
                        url: product.url,
                        priceChange: percentDrop,
                        stats: stats30d ? { min: stats30d.min, avg: stats30d.average, max: stats30d.max } : {}
                    });

                    if (analysis && analysis.score) {
                        const scoreEmoji = analysis.score >= 80 ? '🟢' : analysis.score >= 50 ? '🟡' : '🔴';
                        // Note: emoji doesn't need escape. Score needs, reason needs.
                        aiInsight = `\n🧠 *AI Score:* ${scoreEmoji} ${analysis.score}/100\n💡 _${escapeMarkdownV2(analysis.reason)}_\n`;
                    }
                });
            } catch (ignore) {
                // AI failure shouldn't stop notification
            }

            const percentLine = tracker.alertType === 'percentage' && tracker.percentageThreshold
                ? (() => {
                    const baseline = tracker.baselinePrice || oldPrice;
                    const target = baseline > 0 ? (baseline * (1 - tracker.percentageThreshold / 100)) : null;
                    const targetText = target ? ` (~EGP ${escapeMarkdownV2(target.toFixed(2))})` : '';
                    return `📉 *Drop Alert:* ${escapeMarkdownV2(String(tracker.percentageThreshold))}%${targetText}`;
                })()
                : '';

            const message = [
                header,
                '',
                `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
                '',
                `💰 *Now:* EGP ${escapeMarkdownV2(newPrice.toFixed(2))}`,
                `❌ *Was:* ~EGP ${escapeMarkdownV2(oldPrice.toFixed(2))}~`,
                `📉 *Drop:* ${escapeMarkdownV2(percentDrop)}% \\(Save EGP ${escapeMarkdownV2(savings.toFixed(2))}\\)`,
                '',
                avgPrice > 0 ? `📊 *Ave:* EGP ${escapeMarkdownV2(avgPrice.toFixed(0))} \\| *Max:* EGP ${escapeMarkdownV2(maxPrice.toFixed(0))}` : '',
                tracker.thresholdPrice ? `🎯 *Target:* EGP ${escapeMarkdownV2(tracker.thresholdPrice.toFixed(2))}` : '',
                percentLine,
                '',
                aiInsight, // Insert AI insight here
                '🛒 *Click link above to buy now\\!*'
            ].filter(Boolean).join('\n');
            let photoUrl = product.imageUrl;

            // Try to generate chart
            try {
                if (product.priceHistory && product.priceHistory.length >= 2) {
                    const chartUrl = await generatePriceHistoryChart(
                        product.name,
                        product.priceHistory,
                        tracker.thresholdPrice
                    );
                    if (chartUrl) photoUrl = chartUrl;
                }
            } catch (chartErr) {
                logger.warn(`Failed to generate chart for alert: ${chartErr.message}`);
            }

            if (photoUrl) {
                await this.bot.telegram.sendPhoto(tracker.chatId, photoUrl, {
                    caption: message,
                    parse_mode: 'MarkdownV2',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: '🛒 Buy Now', url: product.url }],
                            [{ text: '💤 Snooze 24h', callback_data: `action_snooze_${product.asin}` }]
                        ]
                    }
                });
            } else {
                await sendMessageWithRetry(this.bot, tracker.chatId, message, {
                    parse_mode: 'MarkdownV2',
                    disable_web_page_preview: false
                });
            }

            // Webhook
            if (tracker.webhookUrl) {
                await sendWebhook(tracker.webhookUrl, 'price_alert', {
                    product: {
                        name: product.name,
                        url: product.url,
                        asin: product.asin,
                        imageUrl: product.imageUrl,
                        aiAnalysis: product.aiAnalysis
                    },
                    oldPrice,
                    newPrice,
                    threshold: tracker.thresholdPrice
                });
            }
        } catch (error) {
            logger.error(`Error notifying user ${tracker.chatId} about product ${product.asin}:`, error);
        }
    }

    async sendBackInStockAlert(chatId, product, currentPrice, thresholdPrice) {
        try {
            const savings = thresholdPrice - currentPrice;
            const percentSavings = ((savings / thresholdPrice) * 100).toFixed(1);

            const message = [
                '🎉 *Back in Stock at Great Price\\!*',
                '',
                `📦 [${escapeMarkdownV2(product.name)}](${escapeMarkdownV2(product.url)})`,
                '',
                '✅ This product is now available and within your budget\\!',
                '',
                `💰 *Current Price:* EGP${escapeMarkdownV2(currentPrice.toFixed(2))}`,
                `🎯 *Your Target:* EGP${escapeMarkdownV2(thresholdPrice.toFixed(2))}`,
                '',
                savings > 0
                    ? `🎊 *Great Deal\\!* You save EGP${escapeMarkdownV2(savings.toFixed(2))} \\(${escapeMarkdownV2(percentSavings)}% below target\\)\\!`
                    : `✨ *Perfect Price\\!* Exactly at your target\\!`,
                '',
                '🛒 Click the product name above to buy now before it sells out again\\!'
            ].join('\n');

            await sendMessageWithRetry(this.bot, chatId, message, {
                parse_mode: 'MarkdownV2',
                disable_web_page_preview: false
            });
        } catch (error) {
            logger.error(`Error notifying user ${chatId} about back-in-stock for ${product.asin}:`, error);
        }
    }
}
