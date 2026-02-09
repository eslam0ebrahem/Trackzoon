import {
  calculatePriceStats,
  calculateVolatility,
  calculateDropProbability,
  predictPriceTrend,
  calculateSeasonalityHint
} from './priceUtils.js';
import { buildSmartTargetSuggestions } from './smartTarget.js';
import { escapeMarkdownV2 } from './messageHelper.js';

const formatMoney = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'N/A';
  return `EGP ${value.toFixed(2)}`;
};

const formatInterval = (minutes) => {
  if (typeof minutes !== 'number' || Number.isNaN(minutes)) return 'N/A';
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`;
};

const formatDateTime = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString();
};

const normalizeTrend = (trend) => {
  if (!trend) return { label: 'STABLE', emoji: '➡️' };
  const raw = String(trend).toUpperCase();
  if (['DOWN', 'DROP', 'FALL'].includes(raw)) return { label: 'DROP', emoji: '📉' };
  if (['UP', 'RISE'].includes(raw)) return { label: 'RISE', emoji: '📈' };
  return { label: 'STABLE', emoji: '➡️' };
};

const getVolatilityLabel = (score) => {
  if (score >= 8) return 'High';
  if (score >= 4) return 'Medium';
  if (score >= 1) return 'Low';
  return 'Stable';
};

const getDealLabel = (label) => {
  const mapping = {
    hot_deal: 'Hot Deal',
    good_deal: 'Good Deal',
    fair_price: 'Fair Price',
    price_hike: 'Price Hike',
    stable: 'Stable'
  };
  return mapping[label] || 'Fair Price';
};

export const buildSmartInsightsMessage = (product = {}) => {
  const name = escapeMarkdownV2(product.name || product.asin || 'Product');
  const url = product.url ? escapeMarkdownV2(product.url) : '';
  const currentPrice = typeof product.currentPrice === 'number' ? product.currentPrice : null;
  const statusLabel = product.isOutOfStock ? 'Out of Stock' : 'In Stock';
  const statusEmoji = product.isOutOfStock ? '⚠️' : '✅';

  const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];
  const stats30d = calculatePriceStats(history, 30);

  const aiPredictionFresh = product.aiPrediction?.lastUpdated
    ? (Date.now() - new Date(product.aiPrediction.lastUpdated).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;
  const trendSource = aiPredictionFresh && product.aiPrediction?.trend
    ? { trend: product.aiPrediction.trend, confidence: product.aiPrediction.confidence }
    : predictPriceTrend(history);
  const trendInfo = normalizeTrend(trendSource?.trend);
  const confidence = typeof trendSource?.confidence === 'number'
    ? Math.round(trendSource.confidence * 100)
    : null;

  const volatility = calculateVolatility(history);
  const volatilityLabel = getVolatilityLabel(volatility.score);

  const dropProbability = stats30d && currentPrice
    ? calculateDropProbability(currentPrice, stats30d, trendSource)
    : null;

  const seasonality = calculateSeasonalityHint(history);
  const targets = buildSmartTargetSuggestions(product).suggestions || [];

  const lines = [
    '🧠 *Smart Insights*',
    '',
    url ? `📦 [${name}](${url})` : `📦 ${name}`,
    '',
    `💰 *Current:* ${escapeMarkdownV2(formatMoney(currentPrice))} ${statusEmoji} ${escapeMarkdownV2(statusLabel)}`,
    `🏷️ *Deal:* ${escapeMarkdownV2(getDealLabel(product.dealLabel))} ${product.smartScore ? `\\(${escapeMarkdownV2(String(product.smartScore))}\\/100\\)` : ''}`.trim(),
    ''
  ];

  if (stats30d) {
    lines.push(
      `📊 *30d Stats:* Low ${escapeMarkdownV2(formatMoney(stats30d.min))} \\| Avg ${escapeMarkdownV2(formatMoney(stats30d.average))} \\| High ${escapeMarkdownV2(formatMoney(stats30d.max))}`
    );
  } else {
    lines.push('📊 *30d Stats:* Not enough data yet');
  }

  lines.push(
    `📈 *Trend:* ${trendInfo.emoji} ${escapeMarkdownV2(trendInfo.label)}${confidence !== null ? ` \\(${escapeMarkdownV2(String(confidence))}% confidence\\)` : ''}`,
    `🌪️ *Volatility:* ${escapeMarkdownV2(volatilityLabel)} \\(${escapeMarkdownV2(String(Math.round(volatility.score)))}\\/10\\) · Checks every ${escapeMarkdownV2(formatInterval(volatility.interval))}`
  );

  if (dropProbability !== null) {
    lines.push(`🎲 *Drop Chance:* ${escapeMarkdownV2(String(dropProbability))}%`);
  }

  if (seasonality) {
    const seasonLine = [
      `🗓️ *Seasonality:* Cheapest month ${escapeMarkdownV2(seasonality.monthName)} avg ${escapeMarkdownV2(formatMoney(seasonality.avgPrice))}`,
      seasonality.nextLowInMonths === 0
        ? '🔵 Historically low this month'
        : seasonality.nextLowInMonths <= 6
          ? `⏳ Next low season in ${escapeMarkdownV2(String(seasonality.nextLowInMonths))} months`
          : ''
    ].filter(Boolean).join(' · ');
    lines.push(seasonLine);
  }

  if (targets.length > 0) {
    lines.push('', '🎯 *Smart Targets:*');
    targets.slice(0, 3).forEach(target => {
      lines.push(`• ${escapeMarkdownV2(target.label)}: ${escapeMarkdownV2(formatMoney(target.targetPrice))}`);
    });
  }

  const nextCheck = formatDateTime(product.nextCheck);
  if (nextCheck) {
    lines.push('', `⏱️ *Next Check:* ${escapeMarkdownV2(nextCheck)}`);
  }

  return lines.filter(Boolean).join('\n');
};
