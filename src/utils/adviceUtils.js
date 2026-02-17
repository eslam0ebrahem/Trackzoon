const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const hasFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);

export const resolveAdviceThresholds = (settings = {}) => {
  const sensitivity = settings.alertSensitivity || 'balanced';
  const defaultMap = {
    aggressive: { buyNow: 65, wait: 35 },
    balanced: { buyNow: 75, wait: 45 },
    strict: { buyNow: 85, wait: 55 }
  };

  const base = defaultMap[sensitivity] || defaultMap.balanced;
  const custom = settings.aiAdviceThresholds || {};

  let buyNow = typeof custom.buyNow === 'number' ? custom.buyNow : base.buyNow;
  let wait = typeof custom.wait === 'number' ? custom.wait : base.wait;

  buyNow = clamp(buyNow, 50, 95);
  wait = clamp(wait, 10, 80);

  if (wait >= buyNow - 5) {
    wait = Math.max(10, buyNow - 10);
  }

  const hasCustom = hasFiniteNumber(custom.buyNow) || hasFiniteNumber(custom.wait);

  return {
    buyNow,
    wait,
    source: hasCustom ? 'custom' : 'sensitivity'
  };
};

export const resolveConfidenceThresholds = (settings = {}) => {
  const sensitivity = settings.alertSensitivity || 'balanced';
  const defaultMap = {
    aggressive: { buyNow: 35, wait: 30 },
    balanced: { buyNow: 45, wait: 35 },
    strict: { buyNow: 60, wait: 45 }
  };

  const base = defaultMap[sensitivity] || defaultMap.balanced;
  const custom = settings.aiConfidenceThresholds || {};

  let buyNow = hasFiniteNumber(custom.buyNow) ? custom.buyNow : base.buyNow;
  let wait = hasFiniteNumber(custom.wait) ? custom.wait : base.wait;

  buyNow = clamp(buyNow, 10, 95);
  wait = clamp(wait, 10, 95);

  if (wait > buyNow) {
    wait = buyNow;
  }

  const hasCustom = hasFiniteNumber(custom.buyNow) || hasFiniteNumber(custom.wait);

  return {
    buyNow,
    wait,
    source: hasCustom ? 'custom' : 'sensitivity'
  };
};

export const computePersonalizedAdvice = ({
  aiAdvice,
  score,
  thresholds,
  confidence,
  confidenceThresholds
} = {}) => {
  const baseAdvice = aiAdvice?.advice || 'neutral';
  let finalAdvice = baseAdvice;
  let adjusted = false;
  const explanations = [];
  const setAdvice = (nextAdvice) => {
    if (nextAdvice !== finalAdvice) {
      adjusted = true;
      finalAdvice = nextAdvice;
    } else {
      finalAdvice = nextAdvice;
    }
  };

  if (typeof score === 'number' && thresholds) {
    if (score >= thresholds.buyNow) {
      setAdvice('buy_now');
      explanations.push(`Smart score ${Math.round(score)}/100 is above Buy threshold (${thresholds.buyNow}).`);
    } else if (score <= thresholds.wait) {
      setAdvice('wait');
      explanations.push(`Smart score ${Math.round(score)}/100 is below Wait threshold (${thresholds.wait}).`);
    } else {
      setAdvice('neutral');
      explanations.push(`Smart score ${Math.round(score)}/100 sits between your thresholds.`);
    }
  } else {
    explanations.push('Smart score is unavailable, so base AI advice was used.');
  }

  const confidencePercent = hasFiniteNumber(confidence)
    ? Math.round(clamp(confidence, 0, 1) * 100)
    : null;

  if (confidencePercent !== null && confidenceThresholds) {
    if (finalAdvice === 'buy_now' && confidencePercent < confidenceThresholds.buyNow) {
      setAdvice('neutral');
      explanations.push(`Confidence ${confidencePercent}% is below your Buy minimum (${confidenceThresholds.buyNow}%).`);
    } else if (finalAdvice === 'wait' && confidencePercent < confidenceThresholds.wait) {
      setAdvice('neutral');
      explanations.push(`Confidence ${confidencePercent}% is below your Wait minimum (${confidenceThresholds.wait}%).`);
    } else if (finalAdvice === 'buy_now') {
      explanations.push(`Confidence ${confidencePercent}% passed your Buy minimum (${confidenceThresholds.buyNow}%).`);
    } else if (finalAdvice === 'wait') {
      explanations.push(`Confidence ${confidencePercent}% passed your Wait minimum (${confidenceThresholds.wait}%).`);
    }
  } else if (confidencePercent !== null) {
    explanations.push(`Confidence score is ${confidencePercent}%.`);
  }

  return {
    finalAdvice,
    adjusted,
    baseAdvice,
    confidencePercent,
    explanations
  };
};
