// Helper utilities for composing and formatting messages for the Telegram bot
// Uses MarkdownV2 escaping and provides rich message formatting with emojis

const escapeMarkdownV2 = (text = '') => {
    // First, handle any pre-escaped characters (those with a single backslash)
    const preProcessed = String(text).replace(/\\([_*\[\]()~`>#+=|{}.!-])/g, '$1');
    // Then escape all special characters
    return preProcessed.replace(/([_*\[\]()~`>#+=|{}.!-])/g, '\\$1');
};

const formatPrice = (price, currency = '£', showTrend = false, oldPrice = null) => {
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
    const percentage = ((newPrice - oldPrice) / oldPrice) * 100;
    const sign = percentage > 0 ? '+' : '';
    const emoji = percentage > 0 ? '📈' : percentage < 0 ? '📉' : '➡️';
    return `${sign}${percentage.toFixed(2)}% ${emoji}`;
};

const formatProductLine = (index, product, tracker, showCurrentPrice = true) => {
  const name = escapeMarkdownV2(product.name || product.asin || 'Unknown');
  const url = product.url || '';
  const threshold = tracker ? tracker.thresholdPrice : (product.thresholdPrice || '—');    
    // Get the previous price for trend
    const previousPrice = product.priceHistory && product.priceHistory.length > 1 
        ? product.priceHistory[product.priceHistory.length - 2].price 
        : null;

    let message = `${index}\\. 📦 [${name}](${url})`;

    if (showCurrentPrice && product.currentPrice) {
        message += `\n   💰 Price: *${escapeMarkdownV2(formatPrice(product.currentPrice, '£', true, previousPrice))}*`;
        message += `\n   🎯 Alert: ${escapeMarkdownV2(formatPrice(threshold))}`;
        
        // Add price difference from threshold
        const diffFromThreshold = ((product.currentPrice - threshold) / threshold) * 100;
        if (diffFromThreshold > 0) {
            message += `\n   ⚠️ *${escapeMarkdownV2(diffFromThreshold.toFixed(1))}% above target*`;
        } else if (diffFromThreshold < 0) {
            message += `\n   ✨ *${escapeMarkdownV2(Math.abs(diffFromThreshold).toFixed(1))}% below target\\!*`;
        }
    }

    return message;
};

const formatProductDetails = (product, tracker) => {
  const name = escapeMarkdownV2(product.name || product.asin || 'Unknown');
  const url = product.url || ''; // URL should not be escaped for Markdown links
  const currentPrice = product.currentPrice;
  const threshold = tracker ? tracker.thresholdPrice : (product.thresholdPrice || '—');

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
    message += `📦 *Name:* [${name}](${url})\n\n`;
    message += `💰 *Current Price:* ${escapeMarkdownV2(formatPrice(currentPrice))}\n`;
    message += `🎯 *Alert Price:* ${escapeMarkdownV2(formatPrice(threshold))}\n\n`;
    message += `📊 *Price Statistics:*\n`;
    message += `   • Lowest: ${escapeMarkdownV2(formatPrice(lowestPrice))}\n`;
    message += `   • Highest: ${escapeMarkdownV2(formatPrice(highestPrice))}\n`;
    message += `   • 30\\-Day Low: ${escapeMarkdownV2(formatPrice(thirtyDayLow))}\n`;
    
    if (priceChange) {
        message += `   • Overall Change: ${escapeMarkdownV2(priceChange)}\n`;
    }

    // Add recommendation
    if (currentPrice <= thirtyDayLow) {
        message += `\n🌟 *Great time to buy\\! Current price is at 30\\-day low\\.*`;
    } else if (currentPrice <= threshold) {
        message += `\n✨ *Good deal\\! Price is below your alert threshold\\.*`;
    } else if (currentPrice >= highestPrice) {
        message += `\n⚠️ *Heads up\\! Price is at all\\-time high\\.*`;
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
    
    // Find tracker info for better messaging
    const hasThresholdMet = product.trackedBy && product.trackedBy.some(t => 
        newPrice <= t.thresholdPrice && oldPrice > t.thresholdPrice
    );
    
    let message = '';
    
    if (isDecrease) {
        if (absChange >= 30) {
            message = `🔥 *HUGE PRICE DROP\\!*\n\n`;
        } else if (absChange >= 15) {
            message = `🎉 *Great Price Drop\\!*\n\n`;
        } else {
            message = `💰 *Price Drop Alert\\!*\n\n`;
        }
    } else {
        message = `📈 *Price Increase Alert*\n\n`;
    }
    
    message += `📦 [${name}](${escapeMarkdownV2(url)})\n\n`;
    
    // Price comparison
    message += `� *Price Change:*\n`;
    message += `├ Was: ~~£${escapeMarkdownV2(oldPrice.toFixed(2))}~~\n`;
    message += `├ Now: *£${escapeMarkdownV2(newPrice.toFixed(2))}*\n`;
    message += `└ Change: ${isDecrease ? '⬇️' : '⬆️'} ${escapeMarkdownV2(absChange.toFixed(1))}%\n\n`;
    
    // Savings or loss
    const diff = Math.abs(newPrice - oldPrice);
    if (isDecrease) {
        message += `💸 *You Save:* £${escapeMarkdownV2(diff.toFixed(2))}\n\n`;
    }
    
    // Add contextual recommendation
    if (isDecrease) {
        if (hasThresholdMet) {
            message += `✅ *Target Price Reached\\!*\n`;
            message += `This product has reached your alert price\\. Time to buy\\!\n\n`;
        } else if (absChange >= 30) {
            message += `🔥 *AMAZING DEAL\\!*\n`;
            message += `This is a massive ${escapeMarkdownV2(absChange.toFixed(0))}% drop\\! Don't miss this opportunity\\!\n\n`;
        } else if (absChange >= 20) {
            message += `⭐ *Excellent Deal\\!*\n`;
            message += `Significant price reduction\\. This is a great time to buy\\!\n\n`;
        } else if (absChange >= 10) {
            message += `👍 *Good Deal\\!*\n`;
            message += `Notable price drop\\. Consider purchasing soon\\!\n\n`;
        } else {
            message += `📉 *Price Decreased*\n`;
            message += `Keep watching\\. The price might drop further\\!\n\n`;
        }
    } else {
        if (absChange >= 15) {
            message += `⚠️ *Significant Increase*\n`;
            message += `Price jumped up considerably\\. Wait for it to drop again\\.\n\n`;
        } else {
            message += `ℹ️ *Price Increased*\n`;
            message += `We'll notify you when it drops back down\\.\n\n`;
        }
    }
    
    message += `🔗 [View on Amazon](${escapeMarkdownV2(url)})`;

    return message;
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
            await ctx.answerCbQuery().catch(() => {}); // Silent acknowledgment
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
    
    // Categorize products
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const priceDrops = [];
    const atTarget = [];
    const priceIncreases = [];
    const noChange = [];
    const bestDeals = [];
    
    products.forEach(product => {
        const tracker = product.trackedBy[0]; // Assuming first tracker is the user's
        const recentHistory = product.priceHistory.slice(-2);
        
        if (recentHistory.length >= 2) {
            const oldPrice = recentHistory[0].price;
            const newPrice = recentHistory[1].price;
            const change = ((newPrice - oldPrice) / oldPrice) * 100;
            
            if (newPrice < oldPrice) {
                priceDrops.push({ product, oldPrice, newPrice, change: Math.abs(change), tracker });
                
                // Check if it's a really good deal (>20% drop)
                if (Math.abs(change) >= 20) {
                    bestDeals.push({ product, oldPrice, newPrice, change: Math.abs(change), tracker });
                }
            } else if (newPrice > oldPrice) {
                priceIncreases.push({ product, oldPrice, newPrice, change, tracker });
            } else {
                noChange.push({ product, price: newPrice, tracker });
            }
            
            // Check if at or below target
            if (tracker && tracker.thresholdPrice && newPrice <= tracker.thresholdPrice) {
                atTarget.push({ product, price: newPrice, target: tracker.thresholdPrice });
            }
        }
    });
    
    let message = [
        `📊 *Daily Price Report*`,
        `Good morning ${escapedName}\\! ☀️`,
        '',
        `📅 ${escapeMarkdownV2(today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }))}`,
        ''
    ].join('\n');
    
    // Hot deals section
    if (bestDeals.length > 0) {
        message += `\n🔥 *HOT DEALS \\- Don't Miss These\\!*\n`;
        bestDeals.slice(0, 3).forEach(({ product, oldPrice, newPrice, change }) => {
            const name = escapeMarkdownV2(product.name.substring(0, 40) + (product.name.length > 40 ? '...' : ''));
            message += `├ ${name}\n`;
            message += `│ ~~£${escapeMarkdownV2(oldPrice.toFixed(2))}~~ → *£${escapeMarkdownV2(newPrice.toFixed(2))}* \\(⬇️${escapeMarkdownV2(change.toFixed(0))}%\\)\n`;
        });
        message += '\n';
    }
    
    // At target section
    if (atTarget.length > 0) {
        message += `\n✅ *Target Price Reached* \\(${atTarget.length}\\)\n`;
        atTarget.slice(0, 3).forEach(({ product, price, target }) => {
            const name = escapeMarkdownV2(product.name.substring(0, 35) + (product.name.length > 35 ? '...' : ''));
            message += `├ ${name}\n`;
            message += `│ £${escapeMarkdownV2(price.toFixed(2))} \\(Target: £${escapeMarkdownV2(target.toFixed(2))}\\)\n`;
        });
        if (atTarget.length > 3) {
            message += `└ \\+${atTarget.length - 3} more ready to buy\\!\n`;
        }
        message += '\n';
    }
    
    // Summary section
    message += `\n📈 *Summary*\n`;
    message += `├ 💚 Price Drops: ${priceDrops.length}\n`;
    message += `├ 💔 Price Increases: ${priceIncreases.length}\n`;
    message += `├ 😴 No Change: ${noChange.length}\n`;
    message += `└ 📦 Total Tracked: ${products.length}\n\n`;
    
    // Price drops detail (if not covered in hot deals)
    if (priceDrops.length > bestDeals.length && priceDrops.length <= 5) {
        message += `\n💰 *Recent Price Drops*\n`;
        priceDrops.filter(item => !bestDeals.includes(item)).slice(0, 3).forEach(({ product, oldPrice, newPrice, change }) => {
            const name = escapeMarkdownV2(product.name.substring(0, 35) + (product.name.length > 35 ? '...' : ''));
            message += `├ ${name}\n`;
            message += `│ ~~£${escapeMarkdownV2(oldPrice.toFixed(2))}~~ → £${escapeMarkdownV2(newPrice.toFixed(2))} \\(⬇️${escapeMarkdownV2(change.toFixed(1))}%\\)\n`;
        });
        message += '\n';
    }
    
    // Action items
    message += `\n💡 *Recommended Actions*\n`;
    if (atTarget.length > 0) {
        message += `• 🛒 ${atTarget.length} product${atTarget.length > 1 ? 's' : ''} at target price \\- ready to buy\\!\n`;
    }
    if (priceDrops.length > 0) {
        message += `• 👀 ${priceDrops.length} price drop${priceDrops.length > 1 ? 's' : ''} \\- check for deals\\!\n`;
    }
    if (priceDrops.length === 0 && atTarget.length === 0) {
        message += `• 😊 No action needed\\. Sit back and relax\\!\n`;
    }
    message += `\n📋 Use /list to see all your tracked products\\.`;
    
    return message;
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
