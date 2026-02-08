import { calculatePriceStats, calculateDropProbability, predictPriceTrend } from './priceUtils.js';

const toMoney = (value) => Number(value.toFixed(2));

const clampTarget = (value, currentPrice) => {
  if (!Number.isFinite(value) || value <= 0) return null;
  if (currentPrice > 0) {
    return toMoney(Math.min(value, currentPrice));
  }
  return toMoney(value);
};

export const buildSmartTargetSuggestions = (product = {}) => {
  const history = Array.isArray(product.priceHistory) ? product.priceHistory : [];
  const currentPrice = product.currentPrice || (history.length > 0 ? history[history.length - 1].price : 0);
  const stats30d = calculatePriceStats(history, 30);

  if (!stats30d || !currentPrice) {
    const fallbackTarget = currentPrice > 0 ? clampTarget(currentPrice * 0.9, currentPrice) : null;
    return {
      stats30d: null,
      dropProbability: null,
      trend: null,
      suggestions: [
        {
          id: 'balanced',
          label: 'Balanced',
          targetPrice: fallbackTarget,
          reason: 'Not enough history. Target ~10% below current price.'
        }
      ].filter(s => s.targetPrice)
    };
  }

  const low = stats30d.min;
  const avg = stats30d.average;
  const stdDev = stats30d.stdDev || 0;
  const trend = product.aiPrediction ? { trend: product.aiPrediction.trend } : predictPriceTrend(history);
  const dropProbability = calculateDropProbability(currentPrice, stats30d, trend);

  const quickRaw = Math.max(low * 1.15, avg * 0.95, avg - stdDev * 0.25);
  const balancedRaw = Math.max(low * 1.05, avg * 0.9, avg - stdDev * 0.5);
  const aggressiveRaw = Math.max(low * 0.98, avg * 0.85, avg - stdDev);

  const quick = clampTarget(quickRaw, currentPrice);
  const balanced = clampTarget(balancedRaw, currentPrice);
  const aggressive = clampTarget(aggressiveRaw, currentPrice);

  const suggestions = [
    {
      id: 'quick',
      label: 'Quick',
      targetPrice: quick,
      reason: 'Likely to hit soon. Around 5% below recent average.'
    },
    {
      id: 'balanced',
      label: 'Balanced',
      targetPrice: balanced,
      reason: 'Near the 30-day low with a reasonable wait.'
    },
    {
      id: 'aggressive',
      label: 'Aggressive',
      targetPrice: aggressive,
      reason: 'Best price hunting. Near or below the 30-day low.'
    }
  ].filter(s => s.targetPrice);

  return { suggestions, stats30d, dropProbability, trend };
};

export const pickSuggestionForSensitivity = (suggestions = [], sensitivity = 'balanced') => {
  if (!suggestions || suggestions.length === 0) return null;
  const mapping = {
    aggressive: 'quick',
    balanced: 'balanced',
    strict: 'aggressive'
  };
  const targetId = mapping[sensitivity] || 'balanced';
  return suggestions.find(s => s.id === targetId) || suggestions[0];
};
