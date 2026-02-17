// Helper utilities for composing and formatting messages for the Telegram bot
// Uses MarkdownV2 escaping and provides rich message formatting with emojis

import { calculatePriceStats, calculateDropProbability, calculateSeasonalityHint } from './priceUtils.js';
import { getReliableTrend } from './trendUtils.js';

const escapeMarkdownV2 = (text = '') => {
    // First, handle any pre-escaped characters (those with a single backslash)
    const preProcessed = String(text).replace(/\\([_*\[\]()~`>#+=|{}.!-])/g, '$1');
    // Then escape all special characters
    return preProcessed.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
};

const formatPrice = (price, currency = 'EGP', showTrend = false, oldPrice = null) => {
    let formatted = `${currency}${price.toFixed(2)}`;

    if (showTrend && oldPrice !== null) {
        if (price < oldPrice) {
            formatted = `${formatted} 📉`; // Decreasing
        } else if (price > oldPrice) {
            formatted = `${formatted} 📈`; // Increasing
        } else {
            formatted = `${formatted} ➡️`; // No change
        }
    }

    return formatted;
};

const formatPercentage = (oldPrice, newPrice) => {
    if (!oldPrice || oldPrice <= 0) return 'N/A';
    const percentage = ((newPrice - oldPrice) / oldPrice) * 100;
    const sign = percentage > 0 ? '+' : '';
    const emoji = percentage > 0 ? '📈' : percentage < 0 ? '📉' : '➡️';
    return `${sign}${percentage.toFixed(2)}% ${emoji}`;
};

const formatProductLine = (index, product, tracker, showCurrentPrice = true) => {
    const name = escapeMarkdownV2(product.name || product.asin || 'Unknown');
    const url = product.url || '';
    const pinPrefix = tracker?.isPinned ? '📌 ' : '';
    const threshold = tracker ? tracker.thresholdPrice : product.thresholdPrice;
    const thresholdValue = typeof threshold === 'number' && !Number.isNaN(threshold) ? threshold : null;
    const isPercentageAlert = tracker?.alertType === 'percentage' && tracker?.percentageThreshold;
    const percentValue = isPercentageAlert ? tracker.percentageThreshold : null;
    const percentBaseline = isPercentageAlert ? (tracker.baselinePrice || product.currentPrice || null) : null;
    const percentTarget = percentBaseline && percentValue
        ? Number((percentBaseline * (1 - percentValue / 100)).toFixed(2))
        : null;
    // Get the previous price for trend
    const previousPrice = product.priceHistory && product.priceHistory.length > 1
        ? product.priceHistory[product.priceHistory.length - 2].price
        : null;

    let message = `${index}\\. ${pinPrefix}📦 [${name}](${url})`;

    if (showCurrentPrice && product.currentPrice) {
        message += `\n   💰 Price: *${escapeMarkdownV2(formatPrice(product.currentPrice, 'EGP', true, previousPrice))}*`;
        if (isPercentageAlert && percentValue) {
            const targetSuffix = percentTarget ? ` (EGP${percentTarget.toFixed(2)})` : '';
            message += `\n   🎯 Alert: ${escapeMarkdownV2(`${percentValue}% drop${targetSuffix}`)}`;
        } else if (thresholdValue !== null) {
            message += `\n   🎯 Alert: ${escapeMarkdownV2(formatPrice(thresholdValue))}`;
        }

        // Add rating if available
        if (product.rating && product.rating.stars > 0) {
            const ratingEmoji = product.rating.stars >= 4.5 ? '🌟' : product.rating.stars >= 4.0 ? '⭐' : product.rating.stars >= 3.5 ? '✨' : product.rating.stars >= 3.0 ? '💫' : '⚠️';
            message += `\n   ${ratingEmoji} Rating: ${escapeMarkdownV2(product.rating.stars.toFixed(1))}/5 \\(${escapeMarkdownV2(product.rating.count.toLocaleString())} reviews\\)`;
        }

        // Add price difference from threshold
        if (thresholdValue !== null) {
            const diffFromThreshold = ((product.currentPrice - thresholdValue) / thresholdValue) * 100;
            if (diffFromThreshold > 0) {
                message += `\n   ⚠️ *${escapeMarkdownV2(diffFromThreshold.toFixed(1))}% above target*`;
            } else if (diffFromThreshold < 0) {
                message += `\n   ✨ *${escapeMarkdownV2(Math.abs(diffFromThreshold).toFixed(1))}% below target\\!*`;
            }
        }
    }

    return message;
};

const formatProductDetails = (product, tracker) => {
    const name = escapeMarkdownV2(product.name || product.asin || 'Unknown');
    const url = product.url || ''; // URL should not be escaped for Markdown links
    const currentPrice = product.currentPrice;
    const threshold = tracker ? tracker.thresholdPrice : product.thresholdPrice;
    const thresholdValue = typeof threshold === 'number' && !Number.isNaN(threshold) ? threshold : null;
    const isPercentageAlert = tracker?.alertType === 'percentage' && tracker?.percentageThreshold;
    const percentValue = isPercentageAlert ? tracker.percentageThreshold : null;
    const percentBaseline = isPercentageAlert ? (tracker.baselinePrice || product.currentPrice || null) : null;
    const percentTarget = percentBaseline && percentValue
        ? Number((percentBaseline * (1 - percentValue / 100)).toFixed(2))
        : null;

    // Calculate price statistics
    let lowestPrice = currentPrice;
    let highestPrice = currentPrice;
    let priceChange = '';
    let thirtyDayLow = currentPrice;

    if (product.priceHistory && product.priceHistory.length > 0) {
        const prices = product.priceHistory.map(h => h.price);
        lowestPrice = Math.min(...prices);
        highestPrice = Math.max(...prices);

        // Calculate 30-day low
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentPrices = product.priceHistory
            .filter(h => new Date(h.date) >= thirtyDaysAgo)
            .map(h => h.price);
        thirtyDayLow = Math.min(...recentPrices);

        // Get price change
        const oldestPrice = product.priceHistory[0].price;
        const latestPrice = product.priceHistory[product.priceHistory.length - 1].price;
        priceChange = formatPercentage(oldestPrice, latestPrice);
    }

    let message = `🛍️ *Product Details*\n\n`;
    message += `📦 *Name:* [${name}](${url})\n`;
    if (tracker?.isPinned) {
        message += `📌 *Pinned:* Yes\n`;
    }
    message += `\n`;

    // Add rating if available
    if (product.rating && product.rating.stars > 0) {
        const ratingEmoji = product.rating.stars >= 4.5 ? '🌟' : product.rating.stars >= 4.0 ? '⭐' : product.rating.stars >= 3.5 ? '✨' : product.rating.stars >= 3.0 ? '💫' : '⚠️';
        message += `${ratingEmoji} *Rating:* ${escapeMarkdownV2(product.rating.stars.toFixed(1))}/5\\.0 \\(${escapeMarkdownV2(product.rating.count.toLocaleString())} reviews\\)\n\n`;
    }

    // Feature 7: Smart Tags
    if (product.tags && product.tags.length > 0) {
        const tagsStr = product.tags.map(t => `#${t.replace(/\s+/g, '')}`).join(' ');
        message += `🏷️ *Tags:* ${escapeMarkdownV2(tagsStr)}\n\n`;
    }

    const usdRate = 50.0; // Approximate EGP/USD rate
    const usdPrice = (currentPrice / usdRate).toFixed(2);

    message += `💰 *Current Price:* ${escapeMarkdownV2(formatPrice(currentPrice))} \\(~\\$${usdPrice} USD\\)\n`;
    if (isPercentageAlert && percentValue) {
        const targetSuffix = percentTarget ? ` (EGP${percentTarget.toFixed(2)})` : '';
        message += `🎯 *Alert:* ${escapeMarkdownV2(`${percentValue}% drop${targetSuffix}`)}\n\n`;
    } else if (thresholdValue !== null) {
        message += `🎯 *Alert Price:* ${escapeMarkdownV2(formatPrice(thresholdValue))}\n\n`;
    } else {
        message += `🎯 *Alert:* ${escapeMarkdownV2('—')}\n\n`;
    }

    // Feature 9: Drop Probability
    if (product.priceHistory && product.priceHistory.length > 5) {
        const stats30d = calculatePriceStats(product.priceHistory, 30);
        const trend = getReliableTrend(product, product.priceHistory);
        const prob = calculateDropProbability(currentPrice, stats30d, trend);

        if (prob > 50) {
            message += `🎲 *Drop Chance:* ${prob}% ${prob > 70 ? '🔥' : '🤔'}\n`;
        }
    }

    message += `📊 *Price Statistics:*\n`;
    message += `   • Lowest: ${escapeMarkdownV2(formatPrice(lowestPrice))}\n`;
    message += `   • Highest: ${escapeMarkdownV2(formatPrice(highestPrice))}\n`;
    message += `   • 30\\-Day Low: ${escapeMarkdownV2(formatPrice(thirtyDayLow))}\n`;

    if (priceChange) {
        message += `   • Overall Change: ${escapeMarkdownV2(priceChange)}\n`;
    }

    const seasonality = calculateSeasonalityHint(product.priceHistory);
    if (seasonality) {
        const monthName = escapeMarkdownV2(seasonality.monthName);
        message += `\n🗓️ *Seasonality:* Cheapest month tends to be ${monthName} \\(avg ${escapeMarkdownV2(formatPrice(seasonality.avgPrice))}\\)`;
        if (seasonality.nextLowInMonths === 0) {
            message += `\n   🔵 This month is historically one of the cheapest\\.`;
        } else if (seasonality.nextLowInMonths <= 3) {
            message += `\n   ⏳ Next low season in ${escapeMarkdownV2(String(seasonality.nextLowInMonths))} month\\(s\\)\\.`;
        }
    }

    if (product.anomaly?.isAnomaly) {
        const reason = product.anomaly.reason ? `: ${escapeMarkdownV2(product.anomaly.reason)}` : '';
        message += `\n⚠️ *Anomaly Detected${reason}*`;
    }

    // Add recommendation
    if (currentPrice <= thirtyDayLow) {
        message += `\n🌟 *Great time to buy\\! Current price is at 30\\-day low\\.*`;
    } else if (currentPrice <= threshold) {
        message += `\n✨ *Good deal\\! Price is below your alert threshold\\.*`;
    } else if (currentPrice >= highestPrice) {
        message += `\n⚠️ *Heads up\\! Price is at all\\-time high\\.*`;
    }

    // Add AI Analysis if available
    if (product.aiAnalysis) {
        message += `\n\n🤖 *AI Analysis:*\n_${escapeMarkdownV2(product.aiAnalysis)}_`;
    }

    if (product.aiBuyingAdvice && product.aiBuyingAdvice.advice) {
        const adviceLabel = product.aiBuyingAdvice.advice === 'buy_now'
            ? 'Buy Now'
            : product.aiBuyingAdvice.advice === 'wait'
                ? 'Wait'
                : 'Neutral';
        message += `\n\n🧠 *AI Buying Advice:* ${escapeMarkdownV2(adviceLabel)}`;
        if (product.aiBuyingAdvice.reasoning) {
            message += `\n_${escapeMarkdownV2(product.aiBuyingAdvice.reasoning)}_`;
        }
    }

    return message;
};

const buildProductListMessage = (products, chatId, options = { showCurrentPrice: true }) => {
    if (!products || products.length === 0) {
        return '🔍 *No products tracked yet*\n\nUse /add to start tracking your first product\\.';
    }

    let message = '📋 *Your Tracked Products*\n\n';

    // Group products by status (below threshold, above threshold)
    const belowThreshold = [];
    const aboveThreshold = [];

    products.forEach((p, idx) => {
        const tracker = Array.isArray(p.trackedBy) ? p.trackedBy.find(t => t.chatId === chatId) : null;
        if (tracker && p.currentPrice <= tracker.thresholdPrice) {
            belowThreshold.push({ p, idx });
        } else {
            aboveThreshold.push({ p, idx });
        }
    });

    // Add deals section if there are any products below threshold
    if (belowThreshold.length > 0) {
        message += '🌟 *Current Deals*\n';
        belowThreshold.forEach(({ p, idx }) => {
            const tracker = p.trackedBy.find(t => t.chatId === chatId);
            message += formatProductLine(idx + 1, p, tracker, options.showCurrentPrice) + '\n\n';
        });
    }

    // Add other products
    if (aboveThreshold.length > 0) {
        if (belowThreshold.length > 0) {
            message += '\n📌 *Other Tracked Products*\n';
        }
        aboveThreshold.forEach(({ p, idx }) => {
            const tracker = p.trackedBy.find(t => t.chatId === chatId);
            message += formatProductLine(idx + 1, p, tracker, options.showCurrentPrice) + '\n\n';
        });
    }

    // Add summary
    message += `\n📊 *Summary:*\n`;
    message += `• Total Products: ${products.length}\n`;
    message += `• Current Deals: ${belowThreshold.length}\n`;
    message += `• Above Target: ${aboveThreshold.length}`;

    return message;
};

const buildPriceAlertMessage = (product, oldPrice, newPrice) => {
    const name = escapeMarkdownV2(product.name || product.asin || 'Unknown');
    const url = product.url || '';
    const change = ((newPrice - oldPrice) / oldPrice) * 100;
    const isDecrease = newPrice < oldPrice;
    const absChange = Math.abs(change);

    // 1. Header & Status
    let header = '';
    if (isDecrease) {
        if (absChange >= 20) header = '🔥 *MEGA DROP ALERT*';
        else if (absChange >= 10) header = '📉 *PRICE DROP ALERT*';
        else header = '💰 *Price Update*';
    } else {
        header = '📈 *Price Increase*';
    }

    // 2. Price Section (Clean & Bold)
    const priceSection = `
*EGP ${escapeMarkdownV2(newPrice.toFixed(2))}*
~~EGP ${escapeMarkdownV2(oldPrice.toFixed(2))}~~ \\(${isDecrease ? '⬇️' : '⬆️'} *${escapeMarkdownV2(absChange.toFixed(0))}%*\\)
    `.trim();

    // 3. AI Insight (The "Brain" part)
    let aiSection = '';
    if (product.aiAnalysis) {
        aiSection = `\n🤖 *AI Verdict:*\n_${escapeMarkdownV2(product.aiAnalysis)}_`;
    }

    // 4. Savings (If applicable)
    let savingsSection = '';
    if (isDecrease) {
        const savings = oldPrice - newPrice;
        savingsSection = `\n💵 *You Save:* EGP ${escapeMarkdownV2(savings.toFixed(2))}`;
    }

    // Feature 10: Price Gap Analysis
    let gapSection = '';
    if (product.stats && product.stats.min > 0) {
        const gapToLow = newPrice - product.stats.min;
        if (gapToLow <= 0) {
            gapSection = `\n🏆 *All-Time Low!* (Best price ever recorded)`;
        } else {
            const gapPercent = ((gapToLow / product.stats.min) * 100).toFixed(1);
            if (gapPercent < 5) {
                gapSection = `\n🤏 *Only ${escapeMarkdownV2(gapPercent)}% above all-time low*`;
            }
        }
    }

    // 5. Target Status
    let targetSection = '';
    const hasThresholdMet = product.trackedBy && product.trackedBy.some(t =>
        newPrice <= t.thresholdPrice && oldPrice > t.thresholdPrice
    );
    if (hasThresholdMet) {
        targetSection = `\n🎯 *Target Reached!*`;
    }

    // Assemble Message
    return `
${header}

📦 [${name}](${escapeMarkdownV2(url)})

${priceSection}${savingsSection}${gapSection}${targetSection}
${aiSection}

🔗 [View on Amazon](${escapeMarkdownV2(url)})
    `.trim();
};

const buildWelcomeMessage = (username) => {
    const escapedName = escapeMarkdownV2(username || 'there');

    let message = `👋 *Welcome ${escapedName}\\!*\n\n`;
    message += `I'm your personal Amazon price tracker\\. I'll help you track product prices and notify you when they drop to your desired level\\.\n\n`;
    message += `🌟 *What I can do:*\n`;
    message += `• Track Amazon product prices 24/7\n`;
    message += `• Send alerts when prices drop\n`;
    message += `• Show price history and statistics\n`;
    message += `• Recommend the best time to buy\n\n`;
    message += `🚀 *Getting Started:*\n`;
    message += `1\\. Use /add to track a new product\n`;
    message += `2\\. Set your desired price alert\n`;
    message += `3\\. Wait for price drop notifications\\!\n\n`;
    message += `Type /help anytime to see all available commands\\.`;

    return message;
};

const buildHelpMessage = () => {
    let message = `🔍 *Available Commands:*\n\n`;

    message += `*Basic Commands:*\n`;
    message += `• /start \\- Start the bot\n`;
    message += `• /help \\- Show this help message\n`;
    message += `• /settings \\- Manage your preferences\n\n`;

    message += `*Product Management:*\n`;
    message += `• /add \\- Track a new product\n`;
    message += `• /list \\- View your tracked products\n`;
    message += `• /view \\- View detailed product info\n`;
    message += `• /remove \\- Stop tracking a product\n\n`;

    message += `*Price Alerts:*\n`;
    message += `• /setthreshold \\- Change price alert\n`;
    message += `• /history \\- View price history\n\n`;

    message += `*Tips:*\n`;
    message += `• Send an Amazon product link to add it quickly\n`;
    message += `• Use inline buttons when available for faster navigation\n`;
    message += `• Check /list regularly for price updates and deals`;

    return message;
};

const buildSettingsMessage = (user) => {
    let message = `⚙️ *Your Settings*\n\n`;
    message += `🔔 *Notifications:* ${user.notifications ? 'Enabled ✅' : 'Disabled ❌'}\n\n`;
    message += `Use the button below to change your settings\\.`;
    return message;
};

// Helper function to safely edit messages without throwing errors when content is the same
const safeEditMessageText = async (ctx, text, options = {}) => {
    try {
        await ctx.editMessageText(text, options);
    } catch (error) {
        // If message content is the same, just acknowledge it silently
        if (error.description && error.description.includes('message is not modified')) {
            await ctx.answerCbQuery().catch(() => { }); // Silent acknowledgment
        } else if (error.description && error.description.includes('no text in the message to edit')) {
            // Message is a photo/media, send new message instead
            await ctx.answerCbQuery().catch(() => { });
            await ctx.reply(text, options).catch(() => { });
        } else {
            // Re-throw other errors
            throw error;
        }
    }
};

// Build daily report message
const buildDailyReportMessage = (products, userName = 'there') => {
    const escapedName = escapeMarkdownV2(userName);

    if (!products || products.length === 0) {
        return [
            `📊 *Daily Report*`,
            '',
            `Good morning ${escapedName}\\!`,
            '',
            `You're not tracking any products yet\\.`,
            'Use /add to start tracking Amazon products\\!'
        ].join('\n');
    }

    // Helper function to get price from ~24 hours ago
    const getPriceFrom24HoursAgo = (priceHistory) => {
        if (!priceHistory || priceHistory.length === 0) return null;

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // Find the closest price entry to 24 hours ago (within 26 hours to be safe)
        let closestEntry = null;
        let closestDiff = Infinity;

        for (const entry of priceHistory) {
            const entryDate = new Date(entry.date);
            const timeDiff = Math.abs(entryDate.getTime() - twentyFourHoursAgo.getTime());

            // Only consider entries from 20-28 hours ago (buffer for scheduler timing)
            if (timeDiff < closestDiff && timeDiff < 28 * 60 * 60 * 1000 && timeDiff > 20 * 60 * 60 * 1000) {
                closestDiff = timeDiff;
                closestEntry = entry;
            }
        }

        // If no entry found in the time window, use the oldest available entry
        if (!closestEntry && priceHistory.length > 0) {
            closestEntry = priceHistory[0];
        }

        return closestEntry;
    };

    // Categorize products
    const today = new Date();

    const priceDrops = [];
    const atTarget = [];
    const priceIncreases = [];
    const noChange = [];
    const bestDeals = [];
    const outOfStock = [];
    let totalSavings = 0;
    let potentialSavings = 0;

    products.forEach(product => {
        const tracker = product.trackedBy[0]; // Assuming first tracker is the user's

        // Check out of stock status
        if (product.isOutOfStock) {
            outOfStock.push({ product, tracker });
            return;
        }

        const currentPrice = product.currentPrice;
        const oldPriceEntry = getPriceFrom24HoursAgo(product.priceHistory);

        // Skip if no historical data or current price unavailable
        if (!oldPriceEntry || !currentPrice) {
            noChange.push({ product, price: currentPrice, tracker });
            return;
        }

        const oldPrice = oldPriceEntry.price;

        // Note: Back-in-stock notifications are handled by the real-time price tracker
        // We don't duplicate that logic here to avoid false positives

        const change = ((currentPrice - oldPrice) / oldPrice) * 100;
        const priceDiff = oldPrice - currentPrice;

        if (currentPrice < oldPrice) {
            priceDrops.push({ product, oldPrice, newPrice: currentPrice, change: Math.abs(change), priceDiff, tracker });
            totalSavings += priceDiff;

            // Check if it's a really good deal (>15% drop or >EGP10 off)
            // SMART ALERT: Check for "fake deals"
            let isFakeDeal = false;
            if (product.priceHistory) {
                const stats30d = calculatePriceStats(product.priceHistory, 30);
                if (stats30d) {
                    // If current price is > 40% above the 30-day LOW, it's not a "hot deal"
                    if (currentPrice > stats30d.min * 1.4) {
                        isFakeDeal = true;
                    }
                }
            }

            if (!isFakeDeal && (Math.abs(change) >= 15 || priceDiff >= 10)) {
                bestDeals.push({ product, oldPrice, newPrice: currentPrice, change: Math.abs(change), priceDiff, tracker });
            }
        } else if (currentPrice > oldPrice) {
            priceIncreases.push({ product, oldPrice, newPrice: currentPrice, change: Math.abs(change), tracker });
        } else {
            noChange.push({ product, price: currentPrice, tracker });
        }

        // Check if at or below target
        if (tracker && tracker.thresholdPrice && currentPrice <= tracker.thresholdPrice) {
            const savings = currentPrice < tracker.thresholdPrice ? tracker.thresholdPrice - currentPrice : 0;
            atTarget.push({ product, price: currentPrice, target: tracker.thresholdPrice, savings });
            potentialSavings += savings;
        }
    });

    // Get time-based greeting
    const hour = today.getHours();
    let greeting = '☀️';
    if (hour < 12) greeting = '🌅';
    else if (hour < 17) greeting = '☀️';
    else if (hour < 21) greeting = '🌆';
    else greeting = '🌙';

    let message = [
        `📊 *Daily Price Report*`,
        `Good morning ${escapedName}\\! ${greeting}`,
        '',
        `📅 ${escapeMarkdownV2(today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}`,
        ''
    ].join('\n');

    // Highlights section
    const highlights = [];
    if (bestDeals.length > 0) highlights.push(`🔥 ${bestDeals.length} hot deal${bestDeals.length > 1 ? 's' : ''}`);
    if (atTarget.length > 0) highlights.push(`✅ ${atTarget.length} at target`);
    if (outOfStock.length > 0) highlights.push(`⚠️ ${outOfStock.length} out of stock`);

    if (highlights.length > 0) {
        message += `*Quick Highlights:* ${highlights.join(' • ')}\n\n`;
        message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    }

    // Hot deals section
    if (bestDeals.length > 0) {
        message += `🔥 *HOT DEALS \\- Don't Miss These\\!*\n\n`;
        bestDeals.slice(0, 5).forEach(({ product, oldPrice, newPrice, change, priceDiff }, index) => {
            const name = escapeMarkdownV2(product.name.substring(0, 45) + (product.name.length > 45 ? '...' : ''));
            const icon = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '🔸';

            message += `${icon} [${name}](${escapeMarkdownV2(product.url)})\n`;
            message += `   ~~EGP${escapeMarkdownV2(oldPrice.toFixed(2))}~~ → *EGP${escapeMarkdownV2(newPrice.toFixed(2))}*\n`;
            message += `   💰 Save EGP${escapeMarkdownV2(priceDiff.toFixed(2))} \\(${escapeMarkdownV2(change.toFixed(0))}% off\\)\n`;

            // Add smart details
            if (product.coupon) message += `   🎟️ *Coupon:* ${escapeMarkdownV2(product.coupon)}\n`;
            if (product.dealProgress) message += `   ⚡ *Lightning Deal:* ${product.dealProgress}% claimed\n`;
            if (product.prime) message += `   🚛 *Prime Delivery*\n`;
            else if (product.delivery && product.delivery.price === 'FREE') message += `   🚚 *Free Delivery*\n`;

            message += `\n`;
        });
    }

    // At target section
    if (atTarget.length > 0) {
        message += `✅ *Target Price Reached* \\(${atTarget.length}\\)\n\n`;
        atTarget.slice(0, 5).forEach(({ product, price, target, savings }) => {
            const name = escapeMarkdownV2(product.name.substring(0, 40) + (product.name.length > 40 ? '...' : ''));
            message += `🎯 [${name}](${escapeMarkdownV2(product.url)})\n`;
            message += `   Current: *EGP${escapeMarkdownV2(price.toFixed(2))}* \\| Target: EGP${escapeMarkdownV2(target.toFixed(2))}\n`;
            if (savings > 0) {
                message += `   💚 Even EGP${escapeMarkdownV2(savings.toFixed(2))} below target\\!\n`;
            }

            // Add smart details
            if (product.merchant && !product.merchant.includes('Amazon')) {
                message += `   🏪 Sold by: ${escapeMarkdownV2(product.merchant)}\n`;
            }
            if (product.coupon) message += `   🎟️ *Plus Coupon:* ${escapeMarkdownV2(product.coupon)}\n`;

            message += `\n`;
        });
        if (atTarget.length > 5) {
            message += `   \\+${atTarget.length - 5} more ready to buy\\!\n\n`;
        }
    }

    // Smart Insights Section (New)
    const productsWithCoupons = products.filter(p => p.coupon && !bestDeals.some(d => d.product.asin === p.asin) && !atTarget.some(t => t.product.asin === p.asin));
    const productsWithOtherSellers = products.filter(p => p.otherSellers && p.otherSellers.length > 0 && p.otherSellers[0].price < p.currentPrice);

    if (productsWithCoupons.length > 0 || productsWithOtherSellers.length > 0) {
        message += `💡 *Smart Insights*\n\n`;

        if (productsWithCoupons.length > 0) {
            message += `🎟️ *Coupons Available:*\n`;
            productsWithCoupons.slice(0, 3).forEach(p => {
                const name = escapeMarkdownV2(p.name.substring(0, 30) + '...');
                message += `   • [${name}](${escapeMarkdownV2(p.url)}): ${escapeMarkdownV2(p.coupon)}\n`;
            });
            message += `\n`;
        }

        if (productsWithOtherSellers.length > 0) {
            message += `📉 *Cheaper Options Found:*\n`;
            productsWithOtherSellers.slice(0, 3).forEach(p => {
                const name = escapeMarkdownV2(p.name.substring(0, 30) + '...');
                const otherPrice = p.otherSellers[0].price;
                const diff = p.currentPrice - otherPrice;
                message += `   • [${name}](${escapeMarkdownV2(p.url)}): Save EGP${escapeMarkdownV2(diff.toFixed(2))} from other seller\n`;
            });
            message += `\n`;
        }
    }

    // Out of stock warning
    if (outOfStock.length > 0) {
        message += `⚠️ *Out of Stock* \\(${outOfStock.length}\\)\n\n`;
        outOfStock.slice(0, 3).forEach(({ product }) => {
            const name = escapeMarkdownV2(product.name.substring(0, 40) + (product.name.length > 40 ? '...' : ''));
            message += `🔴 [${name}](${escapeMarkdownV2(product.url)})\n`;
        });
        if (outOfStock.length > 3) {
            message += `   \\+${outOfStock.length - 3} more unavailable\n`;
        }
        message += `\n_We'll notify you when they're back\\!_\n\n`;
    }

    // Summary section with visual bars
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `📊 *Daily Summary*\n\n`;

    const inStockCount = products.length - outOfStock.length;
    message += `📦 *Total Products:* ${products.length}\n`;
    if (inStockCount > 0) {
        message += `   └ 🟢 In Stock: ${inStockCount}\n`;
    }
    if (outOfStock.length > 0) {
        message += `   └ 🔴 Out of Stock: ${outOfStock.length}\n`;
    }
    message += `\n`;

    if (priceDrops.length > 0) {
        message += `📉 *Price Drops:* ${priceDrops.length}\n`;
    }
    if (priceIncreases.length > 0) {
        message += `📈 *Price Increases:* ${priceIncreases.length}\n`;
    }
    if (noChange.length > 0) {
        message += `😴 *No Change:* ${noChange.length}\n`;
    }
    message += `\n`;

    // Savings section
    if (totalSavings > 0 || potentialSavings > 0) {
        message += `💰 *Your Savings*\n`;
        if (totalSavings > 0) {
            message += `   • 24h Savings: *EGP${escapeMarkdownV2(totalSavings.toFixed(2))}*\n`;
        }
        if (potentialSavings > 0) {
            message += `   • Extra Savings: EGP${escapeMarkdownV2(potentialSavings.toFixed(2))} \\(below target\\)\n`;
        }
        message += `\n`;
    }

    // Trending section
    if (priceDrops.length > 3) {
        message += `📉 *Trending Down* \\- More drops than usual\\!\n\n`;
    } else if (priceIncreases.length > priceDrops.length && priceIncreases.length > 3) {
        message += `📈 *Trending Up* \\- Prices rising\\. Consider buying soon\\!\n\n`;
    }

    // Action items
    message += `━━━━━━━━━━━━━━━━━━━━\n\n`;
    message += `💡 *What to Do Next*\n\n`;
    let actionCount = 0;

    if (atTarget.length > 0) {
        actionCount++;
        message += `${actionCount}\\. 🛒 *Buy now* \\- ${atTarget.length} product${atTarget.length > 1 ? 's' : ''} at your target price\\!\n`;
    }
    if (bestDeals.length > 0) {
        actionCount++;
        message += `${actionCount}\\. 🔥 *Check hot deals* \\- Big discounts available\\!\n`;
    }
    if (productsWithCoupons.length > 0) {
        actionCount++;
        message += `${actionCount}\\. 🎟️ *Clip coupons* \\- Extra savings available on ${productsWithCoupons.length} items\n`;
    }
    if (priceDrops.length > 0 && bestDeals.length === 0) {
        actionCount++;
        message += `${actionCount}\\. 👀 *Review price drops* \\- ${priceDrops.length} item${priceDrops.length > 1 ? 's' : ''} cheaper today\\!\n`;
    }
    if (actionCount === 0) {
        message += `😊 *Relax\\!* No urgent actions needed\\. Keep tracking\\!\n`;
    }

    message += `\n📋 Type /list to see all your products\\.`;

    return message;
};

/**
 * Send message helper function
 */
export const sendMessage = async (bot, chatId, text, options = {}) => {
    try {
        return await bot.telegram.sendMessage(chatId, text, {
            parse_mode: 'Markdown',
            disable_web_page_preview: true,
            ...options
        });
    } catch (error) {
        console.error(`Error sending message to ${chatId}:`, error.message);
        throw error;
    }
};

export {
    escapeMarkdownV2,
    formatProductLine,
    buildPriceAlertMessage,
    formatProductDetails,
    buildProductListMessage,
    buildWelcomeMessage,
    buildHelpMessage,
    buildSettingsMessage,
    safeEditMessageText,
    buildDailyReportMessage
};
