import {
  resolveAdviceThresholds,
  resolveConfidenceThresholds,
  computePersonalizedAdvice
} from '../utils/adviceUtils.js';

describe('adviceUtils', () => {
  test('resolveAdviceThresholds uses custom values and marks source', () => {
    const thresholds = resolveAdviceThresholds({
      alertSensitivity: 'balanced',
      aiAdviceThresholds: { buyNow: 82, wait: 30 }
    });

    expect(thresholds.buyNow).toBe(82);
    expect(thresholds.wait).toBe(30);
    expect(thresholds.source).toBe('custom');
  });

  test('resolveConfidenceThresholds enforces wait <= buy and clamps values', () => {
    const thresholds = resolveConfidenceThresholds({
      aiConfidenceThresholds: { buyNow: 25, wait: 90 }
    });

    expect(thresholds.buyNow).toBe(25);
    expect(thresholds.wait).toBe(25);
    expect(thresholds.source).toBe('custom');
  });

  test('computePersonalizedAdvice downgrades buy advice when confidence is below guard', () => {
    const result = computePersonalizedAdvice({
      aiAdvice: { advice: 'buy_now' },
      score: 88,
      thresholds: { buyNow: 75, wait: 45 },
      confidence: 0.39,
      confidenceThresholds: { buyNow: 45, wait: 35 }
    });

    expect(result.finalAdvice).toBe('neutral');
    expect(result.adjusted).toBe(true);
    expect(result.explanations.join(' ')).toContain('below your Buy minimum');
  });

  test('computePersonalizedAdvice keeps base advice when score is unavailable', () => {
    const result = computePersonalizedAdvice({
      aiAdvice: { advice: 'wait' },
      confidence: 0.9,
      confidenceThresholds: { buyNow: 45, wait: 35 }
    });

    expect(result.baseAdvice).toBe('wait');
    expect(result.finalAdvice).toBe('wait');
    expect(result.explanations.join(' ')).toContain('Smart score is unavailable');
  });
});
