import { ProductService } from '../services/productService.js';
import { UserService } from '../services/userService.js';
import { calculatePriceStats, calculateDropProbability, predictPriceTrend } from '../utils/priceUtils.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';

const formatMoney = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return `EGP ${value.toFixed(2)}`;
};

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

const formatLink = (product) => {
  const name = escapeMarkdownV2(product.name || product.asin || 'Product');
  const url = product.url ? escapeMarkdownV2(product.url) : '';
  return url ? `[${name}](${url})` : name;
};

const getTrackerTarget = (product) => {
  const tracker = product.currentUserSubscription || (Array.isArray(product.trackedBy) ? product.trackedBy[0] : null);
  if (!tracker) return null;

  if (tracker.alertType === 'percentage' && tracker.percentageThreshold) {
    const baseline = tracker.baselinePrice || product.currentPrice;
    if (baseline && baseline > 0) {
      return Number((baseline * (1 - tracker.percentageThreshold / 100)).toFixed(2));
    }
    return null;
  }

  if (typeof tracker.thresholdPrice === 'number') return tracker.thresholdPrice;
  return null;
};

const buildSection = (title, lines) => {
  if (!lines || lines.length === 0) {
    return `${title}\n${escapeMarkdownV2('No items to show right now.')}`;
  }
  return [title, ...lines].join('\n');
};

export default (bot) => {
  bot.command('digest', async (ctx) => {
    try {
      const user = await UserService.getOrCreateUser(ctx.chat.id);
      const products = await ProductService.getUserProducts(ctx.chat.id);

      if (!products || products.length === 0) {
        return await ctx.reply(
          '🧠 You are not tracking any products yet.\nUse /add to start tracking.',
          { parse_mode: 'Markdown' }
        );
      }

      const now = Date.now();
      const last24h = now - (24 * 60 * 60 * 1000);
      const dropThreshold = user.settings?.dropProbabilityAlerts?.threshold ?? 65;

      const recentDrops = products
        .filter(p => p.lastPriceChange?.date && new Date(p.lastPriceChange.date).getTime() >= last24h)
        .filter(p => typeof p.lastPriceChange?.percent === 'number' && p.lastPriceChange.percent < 0)
        .sort((a, b) => a.lastPriceChange.percent - b.lastPriceChange.percent)
        .slice(0, 5);

      const nearTarget = products
        .map(p => {
          const target = getTrackerTarget(p);
          if (!target || !p.currentPrice || target <= 0) return null;
          const diffPercent = ((p.currentPrice - target) / target) * 100;
          return { product: p, target, diffPercent };
        })
        .filter(Boolean)
        .filter(item => item.diffPercent <= 5)
        .sort((a, b) => a.diffPercent - b.diffPercent)
        .slice(0, 5);

      const likelyDrops = products
        .map(p => {
          if (!p.currentPrice || p.currentPrice <= 0) return null;
          const stats30d = calculatePriceStats(p.priceHistory, 30);
          if (!stats30d) return null;
          const trend = p.aiPrediction ? { trend: p.aiPrediction.trend } : predictPriceTrend(p.priceHistory);
          const probability = calculateDropProbability(p.currentPrice, stats30d, trend);
          return { product: p, probability };
        })
        .filter(Boolean)
        .filter(item => item.probability >= dropThreshold)
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 5);

      const bestValue = products
        .filter(p => typeof p.smartScore === 'number')
        .sort((a, b) => b.smartScore - a.smartScore)
        .slice(0, 5);

      const outOfStock = products.filter(p => p.isOutOfStock).slice(0, 3);

      const header = [
        '🧠 *Smart Digest*',
        '',
        `📌 Tracking: ${escapeMarkdownV2(String(products.length))} items`
      ].join('\n');

      const recentLines = recentDrops.map((p, idx) => {
        const percent = formatPercent(p.lastPriceChange.percent);
        return `${idx + 1}\\. 📉 ${formatLink(p)} \\| ${escapeMarkdownV2(formatMoney(p.currentPrice))} \\(${escapeMarkdownV2(percent)}\\)`;
      });

      const targetLines = nearTarget.map((item, idx) => {
        const diffLabel = item.diffPercent <= 0 ? 'at target' : `${formatPercent(item.diffPercent)} above`;
        return `${idx + 1}\\. 🎯 ${formatLink(item.product)} \\| ${escapeMarkdownV2(formatMoney(item.product.currentPrice))} \\(target ${escapeMarkdownV2(formatMoney(item.target))}, ${escapeMarkdownV2(diffLabel)}\\)`;
      });

      const dropLines = likelyDrops.map((item, idx) => {
        return `${idx + 1}\\. 🎲 ${formatLink(item.product)} \\| ${escapeMarkdownV2(String(item.probability))}% chance`;
      });

      const valueLines = bestValue.map((p, idx) => {
        return `${idx + 1}\\. ✅ ${formatLink(p)} \\| ${escapeMarkdownV2(formatMoney(p.currentPrice))} \\(score ${escapeMarkdownV2(String(p.smartScore))}\\)`;
      });

      const stockLines = outOfStock.map((p, idx) => {
        return `${idx + 1}\\. ⚠️ ${formatLink(p)} \\| ${escapeMarkdownV2('Out of stock')}`;
      });

      let aiSummary = null;
      if (process.env.GROQ_API_KEY) {
        try {
          const { aiService } = await import('../services/aiService.js');
          const aiProducts = products.map(p => {
            const lastChange = p.lastPriceChange || {};
            const base = p.toObject ? p.toObject() : p;
            return {
              ...base,
              priceChange: typeof lastChange.percent === 'number' ? lastChange.percent : 0,
              oldPrice: typeof lastChange.oldPrice === 'number' ? lastChange.oldPrice : p.currentPrice
            };
          });
          aiSummary = await aiService.generateDailySummary(aiProducts);
        } catch (err) {
          console.error('AI digest summary failed:', err.message);
        }
      }

      const sections = [
        buildSection('🔥 *Recent Drops / 24h*', recentLines),
        buildSection('🎯 *Near Your Target / within 5%*', targetLines),
        buildSection(`🎲 *Likely Drops / above ${escapeMarkdownV2(String(dropThreshold))}%*`, dropLines),
        buildSection('📈 *Best Value / Smart Score*', valueLines),
        buildSection('⚠️ *Out of Stock*', stockLines)
      ];

      let message = [header, '', ...sections].join('\n\n');

      if (aiSummary) {
        message += `\n\n🤖 *AI Summary:*\n_${escapeMarkdownV2(aiSummary)}_`;
      }

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2',
        disable_web_page_preview: true
      });
    } catch (error) {
      console.error('Error in digest command:', error);
      await ctx.reply('⚠️ Failed to generate Smart Digest. Please try again later.');
    }
  });
};
