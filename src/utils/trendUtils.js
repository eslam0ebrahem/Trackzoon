import { predictPriceTrend } from './priceUtils.js';

export const getReliableTrend = (product, history = []) => {
  const aiTrend = product?.aiPrediction?.trend;
  const aiConfidence = product?.aiPrediction?.confidence ?? 0;

  if (aiTrend && aiConfidence >= 0.35) {
    return {
      trend: aiTrend,
      confidence: aiConfidence,
      source: 'ai'
    };
  }

  const fallback = predictPriceTrend(history);
  return { ...fallback, source: 'stats' };
};
