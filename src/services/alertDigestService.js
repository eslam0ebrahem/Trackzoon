import cache from '../config/cache.js';
import { logger } from '../utils/logger.js';
import { escapeMarkdownV2 } from '../utils/messageHelper.js';
import { sendMessageWithRetry } from '../utils/retry.js';

const DIGEST_WINDOW_MINUTES = Number(process.env.ALERT_DIGEST_WINDOW_MINUTES || 10);
const DIGEST_WINDOW_MS = Math.max(1, DIGEST_WINDOW_MINUTES) * 60 * 1000;
const DIGEST_MAX_ITEMS = Number(process.env.ALERT_DIGEST_MAX_ITEMS || 5);
const DIGEST_META_TTL_SECONDS = Math.ceil((DIGEST_WINDOW_MS * 2) / 1000);

const DIGEST_ACTIVE_KEY = 'alert:digest:active';
const getMetaKey = (chatId) => `alert:digest:meta:${chatId}`;
const getListKey = (chatId) => `alert:digest:list:${chatId}`;

const memoryDigests = new Map();

const buildDigestMessage = (items, windowMinutes = DIGEST_WINDOW_MINUTES) => {
  const header = `🧾 *Price Drop Digest*`;
  const sub = windowMinutes ? `_Last ${windowMinutes} min_` : '';

  const lines = [header, sub, ''];

  const visible = items.slice(0, DIGEST_MAX_ITEMS);
  visible.forEach((item, index) => {
    const name = escapeMarkdownV2(item.name || 'Unknown');
    const url = escapeMarkdownV2(item.url || '');
    const percent = typeof item.percentDrop === 'number' ? item.percentDrop.toFixed(1) : '0.0';
    const price = typeof item.newPrice === 'number' ? item.newPrice.toFixed(2) : '0.00';
    const quality = item.qualityLabel ? ` • ${escapeMarkdownV2(item.qualityLabel)}` : '';
    const qualityEmoji = item.qualityEmoji || '📦';

    lines.push(`${index + 1}\\. ${qualityEmoji} [${name}](${url})`);
    lines.push(`   💰 Now: EGP ${escapeMarkdownV2(price)} | 📉 ${escapeMarkdownV2(percent)}%${quality}`);
    lines.push('');
  });

  const remaining = items.length - visible.length;
  if (remaining > 0) {
    lines.push(`+${remaining} more deals in this digest`);
  }

  return lines.filter(Boolean).join('\n');
};

export class AlertDigestService {
  constructor(bot) {
    this.bot = bot;
  }

  isRedisEnabled() {
    return Boolean(cache.isEnabled() && cache.getClient());
  }

  async shouldBundle(chatId) {
    const now = Date.now();
    if (this.isRedisEnabled()) {
      const meta = await cache.get(getMetaKey(chatId));
      if (!meta) return false;
      return now - meta.openedAt < DIGEST_WINDOW_MS;
    }

    const entry = memoryDigests.get(chatId);
    if (!entry) return false;
    return now - entry.openedAt < DIGEST_WINDOW_MS;
  }

  async openWindow(chatId) {
    const now = Date.now();
    if (this.isRedisEnabled()) {
      const metaKey = getMetaKey(chatId);
      const existing = await cache.get(metaKey);
      if (existing && now - existing.openedAt < DIGEST_WINDOW_MS) return;

      await cache.set(metaKey, { openedAt: now, queued: 0, lastUpdated: now }, DIGEST_META_TTL_SECONDS);

      const redis = cache.getClient();
      await redis.sadd(DIGEST_ACTIVE_KEY, String(chatId));
      await redis.expire(DIGEST_ACTIVE_KEY, DIGEST_META_TTL_SECONDS * 2);
      return;
    }

    if (!memoryDigests.has(chatId)) {
      memoryDigests.set(chatId, { openedAt: now, items: [], timer: null });
    }
  }

  async enqueue(chatId, item) {
    const now = Date.now();
    if (this.isRedisEnabled()) {
      const redis = cache.getClient();
      const listKey = getListKey(chatId);
      const metaKey = getMetaKey(chatId);

      await redis.rpush(listKey, JSON.stringify(item));
      await redis.expire(listKey, DIGEST_META_TTL_SECONDS);

      const meta = (await cache.get(metaKey)) || { openedAt: now, queued: 0 };
      meta.queued = (meta.queued || 0) + 1;
      meta.lastUpdated = now;
      await cache.set(metaKey, meta, DIGEST_META_TTL_SECONDS);

      await redis.sadd(DIGEST_ACTIVE_KEY, String(chatId));
      await redis.expire(DIGEST_ACTIVE_KEY, DIGEST_META_TTL_SECONDS * 2);
      return;
    }

    const entry = memoryDigests.get(chatId) || { openedAt: now, items: [], timer: null };
    entry.items.push(item);

    if (!entry.timer) {
      const remaining = Math.max(1000, entry.openedAt + DIGEST_WINDOW_MS - now);
      entry.timer = setTimeout(() => {
        this.flushMemory(chatId).catch(err => logger.warn(`Digest flush failed: ${err.message}`));
      }, remaining);
    }

    memoryDigests.set(chatId, entry);
  }

  async flushDueDigests() {
    if (!this.isRedisEnabled()) return;
    const redis = cache.getClient();
    let chatIds = [];

    try {
      chatIds = await redis.smembers(DIGEST_ACTIVE_KEY);
    } catch (error) {
      logger.warn(`Failed to read digest active set: ${error.message}`);
      return;
    }

    const now = Date.now();
    for (const chatId of chatIds) {
      const meta = await cache.get(getMetaKey(chatId));
      if (!meta) {
        await redis.srem(DIGEST_ACTIVE_KEY, chatId);
        continue;
      }

      if (now - meta.openedAt < DIGEST_WINDOW_MS) continue;

      const listKey = getListKey(chatId);
      const rawItems = await redis.lrange(listKey, 0, -1);
      if (rawItems.length > 0) {
        const items = rawItems.map((raw) => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        }).filter(Boolean);

        await this.sendDigest(chatId, items);
      }

      await redis.del(listKey);
      await cache.del(getMetaKey(chatId));
      await redis.srem(DIGEST_ACTIVE_KEY, chatId);
    }
  }

  async flushMemory(chatId) {
    const entry = memoryDigests.get(chatId);
    if (!entry) return;

    const now = Date.now();
    if (now - entry.openedAt < DIGEST_WINDOW_MS) {
      const remaining = Math.max(1000, entry.openedAt + DIGEST_WINDOW_MS - now);
      entry.timer = setTimeout(() => {
        this.flushMemory(chatId).catch(err => logger.warn(`Digest flush failed: ${err.message}`));
      }, remaining);
      memoryDigests.set(chatId, entry);
      return;
    }

    entry.timer = null;
    if (entry.items.length > 0) {
      await this.sendDigest(chatId, entry.items);
    }

    memoryDigests.delete(chatId);
  }

  async sendDigest(chatId, items) {
    if (!this.bot || !items || items.length === 0) return;
    const message = buildDigestMessage(items);
    await sendMessageWithRetry(this.bot, chatId, message, {
      parse_mode: 'MarkdownV2',
      disable_web_page_preview: true
    });
  }
}

export default AlertDigestService;
