export const detectPriceAnomaly = ({
  product,
  oldPrice,
  newPrice,
  priceChangePercent,
  stats30d
}) => {
  const historyLength = Array.isArray(product?.priceHistory) ? product.priceHistory.length : 0;
  if (!stats30d || !stats30d.stdDev || historyLength < 6) {
    return { isAnomaly: false, score: 0, reason: null };
  }

  if (!Number.isFinite(oldPrice) || !Number.isFinite(newPrice)) {
    return { isAnomaly: false, score: 0, reason: null };
  }

  const stdDev = stats30d.stdDev;
  if (stdDev <= 0) return { isAnomaly: false, score: 0, reason: null };

  const zScore = (newPrice - stats30d.average) / stdDev;
  let score = 0;
  const reasons = [];

  if (priceChangePercent <= -35 && zScore <= -3) {
    score += 0.6;
    reasons.push('extreme drop');
  }

  if (priceChangePercent >= 60 && zScore >= 3) {
    score += 0.6;
    reasons.push('extreme spike');
  }

  if (newPrice < stats30d.min * 0.6) {
    score += 0.35;
    reasons.push('below historical low');
  }

  if (newPrice > stats30d.max * 1.8) {
    score += 0.35;
    reasons.push('above historical high');
  }

  if (product?.lastPriceChange?.date && typeof product.lastPriceChange.percent === 'number') {
    const hoursSince = (Date.now() - new Date(product.lastPriceChange.date).getTime()) / (1000 * 60 * 60);
    const lastPercent = product.lastPriceChange.percent;
    const oppositeDirection = Math.sign(lastPercent) !== Math.sign(priceChangePercent);
    if (hoursSince <= 2 && oppositeDirection && Math.abs(lastPercent) >= 15 && Math.abs(priceChangePercent) >= 20) {
      score += 0.35;
      reasons.push('price whiplash');
    }
  }

  const finalScore = Math.min(1, Number(score.toFixed(2)));
  return {
    isAnomaly: finalScore >= 0.7,
    score: finalScore,
    reason: reasons.join(', ')
  };
};
