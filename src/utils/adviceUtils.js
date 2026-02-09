const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

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

  return {
    buyNow,
    wait,
    source: custom.buyNow || custom.wait ? 'custom' : 'sensitivity'
  };
};

export const computePersonalizedAdvice = ({
  aiAdvice,
  score,
  thresholds,
  confidence
} = {}) => {
  let finalAdvice = aiAdvice?.advice || 'neutral';
  let adjusted = false;

  if (typeof score === 'number' && thresholds) {
    if (score >= thresholds.buyNow) {
      finalAdvice = 'buy_now';
      adjusted = true;
    } else if (score <= thresholds.wait) {
      finalAdvice = 'wait';
      adjusted = true;
    } else {
      finalAdvice = 'neutral';
      adjusted = true;
    }
  }

  if (typeof confidence === 'number' && confidence < 0.4 && finalAdvice === 'buy_now') {
    finalAdvice = 'neutral';
    adjusted = true;
  }

  return { finalAdvice, adjusted };
};
