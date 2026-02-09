const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export const computeDecisionConfidence = ({
  priceHistory = [],
  stats30d = null,
  volatilityScore = 0,
  isOutOfStock = false,
  lastPriceChangeAt = null
} = {}) => {
  let confidence = 0;
  const count = Array.isArray(priceHistory) ? priceHistory.length : 0;

  if (count >= 12) confidence += 0.4;
  else if (count >= 6) confidence += 0.3;
  else if (count >= 3) confidence += 0.2;
  else if (count >= 1) confidence += 0.1;

  if (stats30d) confidence += 0.25;

  if (typeof volatilityScore === 'number') {
    if (volatilityScore <= 2) confidence += 0.2;
    else if (volatilityScore <= 5) confidence += 0.1;
    else confidence += 0.05;
  }

  if (isOutOfStock) confidence -= 0.2;

  if (lastPriceChangeAt) {
    const hoursSince = (Date.now() - new Date(lastPriceChangeAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince <= 24) confidence += 0.05;
  }

  return clamp(Number(confidence.toFixed(2)));
};
