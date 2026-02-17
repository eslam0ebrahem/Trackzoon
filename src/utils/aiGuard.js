import crypto from 'crypto';
import cache from '../config/cache.js';
import { logger } from './logger.js';

const memoryState = {
  disabledUntil: 0,
  dailyTokens: new Map(),
  dailyRequests: new Map(),
  cooldowns: new Map()
};

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const getRedis = () => {
  const client = cache.getClient();
  if (!client || !cache.isEnabled()) return null;
  return client;
};

const hashKey = (value) => {
  if (!value) return null;
  return crypto.createHash('sha1').update(value).digest('hex').slice(0, 12);
};

const availabilityKey = (asin, url) => {
  if (asin) return `ai:availability:cooldown:${asin}`;
  const hash = hashKey(url);
  return hash ? `ai:availability:cooldown:${hash}` : null;
};

export const getGlobalDisabledUntil = async () => {
  const redis = getRedis();
  if (redis) {
    const value = await redis.get('ai:global:disabled_until');
    return value ? Number(value) : 0;
  }
  return memoryState.disabledUntil;
};

export const isGlobalAiDisabled = async () => {
  const until = await getGlobalDisabledUntil();
  return until && until > Date.now();
};

export const pauseGlobalAi = async (seconds = 300, reason = 'unknown') => {
  const until = Date.now() + Math.max(10, seconds) * 1000;
  const redis = getRedis();
  if (redis) {
    await redis.set('ai:global:disabled_until', String(until), 'EX', Math.max(10, seconds));
  } else {
    memoryState.disabledUntil = until;
  }
  logger.warn(`⏸️ AI paused for ${seconds}s (${reason}).`);
};

export const getDailyUsage = async () => {
  const key = getTodayKey();
  const redis = getRedis();
  if (redis) {
    const [tokensRaw, reqRaw] = await redis.mget(`ai:tokens:${key}`, `ai:reqs:${key}`);
    return {
      tokens: tokensRaw ? Number(tokensRaw) : 0,
      requests: reqRaw ? Number(reqRaw) : 0
    };
  }
  return {
    tokens: memoryState.dailyTokens.get(key) || 0,
    requests: memoryState.dailyRequests.get(key) || 0
  };
};

export const incrementDailyUsage = async ({ tokens = 0, requests = 1 } = {}) => {
  const key = getTodayKey();
  const redis = getRedis();
  if (redis) {
    const pipeline = redis.multi();
    if (tokens) pipeline.incrby(`ai:tokens:${key}`, tokens);
    if (requests) pipeline.incrby(`ai:reqs:${key}`, requests);
    pipeline.expire(`ai:tokens:${key}`, 2 * 24 * 3600);
    pipeline.expire(`ai:reqs:${key}`, 2 * 24 * 3600);
    await pipeline.exec();
    return;
  }

  const currentTokens = memoryState.dailyTokens.get(key) || 0;
  const currentReqs = memoryState.dailyRequests.get(key) || 0;
  memoryState.dailyTokens.set(key, currentTokens + tokens);
  memoryState.dailyRequests.set(key, currentReqs + requests);
};

export const shouldAllowAiCall = async ({
  tokenEstimate = 1200,
  dailyTokenLimit = Number(process.env.AI_DAILY_TOKEN_LIMIT || 450000),
  dailyRequestLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT || 0)
} = {}) => {
  if (await isGlobalAiDisabled()) {
    return { allowed: false, reason: 'circuit-open' };
  }

  const usage = await getDailyUsage();

  if (dailyTokenLimit && usage.tokens + tokenEstimate > dailyTokenLimit) {
    return { allowed: false, reason: 'daily-token-budget' };
  }

  if (dailyRequestLimit && usage.requests + 1 > dailyRequestLimit) {
    return { allowed: false, reason: 'daily-request-budget' };
  }

  return { allowed: true, reason: null };
};

export const getAiBudgetTelemetry = async ({
  dailyTokenLimit = Number(process.env.AI_DAILY_TOKEN_LIMIT || 450000),
  dailyRequestLimit = Number(process.env.AI_DAILY_REQUEST_LIMIT || 0)
} = {}) => {
  const usage = await getDailyUsage();
  const now = Date.now();
  const disabledUntil = await getGlobalDisabledUntil();
  const pauseRemainingSeconds = disabledUntil > now ? Math.ceil((disabledUntil - now) / 1000) : 0;

  const tokenLimit = Number.isFinite(dailyTokenLimit) && dailyTokenLimit > 0
    ? Math.round(dailyTokenLimit)
    : null;
  const requestLimit = Number.isFinite(dailyRequestLimit) && dailyRequestLimit > 0
    ? Math.round(dailyRequestLimit)
    : null;

  const tokenRemaining = tokenLimit !== null
    ? Math.max(0, tokenLimit - usage.tokens)
    : null;
  const requestRemaining = requestLimit !== null
    ? Math.max(0, requestLimit - usage.requests)
    : null;

  return {
    date: getTodayKey(),
    usage,
    limits: {
      tokens: tokenLimit,
      requests: requestLimit
    },
    remaining: {
      tokens: tokenRemaining,
      requests: requestRemaining
    },
    usagePercent: {
      tokens: tokenLimit ? Number(((usage.tokens / tokenLimit) * 100).toFixed(1)) : null,
      requests: requestLimit ? Number(((usage.requests / requestLimit) * 100).toFixed(1)) : null
    },
    paused: pauseRemainingSeconds > 0,
    pauseRemainingSeconds,
    pausedUntil: pauseRemainingSeconds > 0 ? new Date(disabledUntil).toISOString() : null
  };
};

export const isAvailabilityCooldownActive = async (asin, url) => {
  const key = availabilityKey(asin, url);
  if (!key) return false;
  const redis = getRedis();
  if (redis) {
    const exists = await redis.exists(key);
    return exists === 1;
  }
  const until = memoryState.cooldowns.get(key) || 0;
  if (!until) return false;
  if (until < Date.now()) {
    memoryState.cooldowns.delete(key);
    return false;
  }
  return true;
};

export const setAvailabilityCooldown = async (asin, url, seconds = 3600) => {
  const key = availabilityKey(asin, url);
  if (!key) return;
  const ttl = Math.max(60, seconds);
  const redis = getRedis();
  if (redis) {
    await redis.set(key, '1', 'EX', ttl);
    return;
  }
  memoryState.cooldowns.set(key, Date.now() + ttl * 1000);
};
