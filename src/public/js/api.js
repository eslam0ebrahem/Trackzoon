// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — api.js
// Upgrades over v1:
//  • Automatic retry with exponential backoff
//  • In-flight request deduplication (same URL won't fire twice concurrently)
//  • Structured error objects with error codes
//  • Centralized auth token management (no scattered localStorage calls)
//  • Response caching for read-heavy endpoints (stats, categories)
//  • All original + new v2 endpoints
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG, STATE } from './config.js';

// ── INTERNAL HELPERS ──────────────────────────────────────────────────────────

/** Pending requests: key → Promise  (deduplication) */
const _inflight = new Map();

/** Simple memory response cache: key → { data, expiresAt } */
const _cache = new Map();

/**
 * Get token from STATE first, then localStorage fallback.
 */
function _getToken() {
    if (STATE.token) return STATE.token;
    try { return localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY + '_token'); } catch { return null; }
}

/**
 * Persist token to both STATE and localStorage.
 */
function _storeToken(token) {
    STATE.token = token;
    try { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY + '_token', token); } catch { /* ignore */ }
}

/**
 * Remove token everywhere.
 */
function _clearToken() {
    STATE.token = null;
    try { localStorage.removeItem(CONFIG.LOCAL_STORAGE_KEY + '_token'); } catch { /* ignore */ }
}

/**
 * Build request headers.
 */
function _headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', ...extra };
    const token = _getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
}

/**
 * Sleep utility for retry backoff.
 */
const _sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * Core fetch with retry + structured error handling.
 * @param {string} path       API path (no host)
 * @param {object} opts       fetch options
 * @param {object} [meta]     { attempts, cache, cacheTtl }
 */
async function _req(path, opts = {}, meta = {}) {
    const { attempts = CONFIG.API_RETRY_ATTEMPTS, cache = false, cacheTtl = 30_000 } = meta;
    const url = '/api' + path;
    const cacheKey = opts.method && opts.method !== 'GET' ? null : (cache ? url : null);

    // ── Cache hit ────────────────────────────────────────────────────────────
    if (cacheKey) {
        const cached = _cache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) return cached.data;
    }

    // ── Deduplication ────────────────────────────────────────────────────────
    const dedupKey = url + JSON.stringify(opts.body || '');
    if (_inflight.has(dedupKey)) return _inflight.get(dedupKey);

    // ── Execute with retry ───────────────────────────────────────────────────
    const execute = async () => {
        let lastError;
        for (let attempt = 0; attempt <= attempts; attempt++) {
            try {
                if (attempt > 0) await _sleep(CONFIG.API_RETRY_DELAY_MS * attempt);
                const res = await fetch(url, { ...opts, headers: _headers(opts.headers) });

                // Token expired / unauthorized
                if (res.status === 401) {
                    _clearToken();
                    throw new APIError('Unauthorized — please log in again', 'AUTH_EXPIRED', 401);
                }

                if (!res.ok) {
                    let errMsg = `HTTP ${res.status}`;
                    try { const body = await res.json(); errMsg = body.error || body.message || errMsg; } catch { /* ignore */ }
                    throw new APIError(errMsg, 'HTTP_ERROR', res.status);
                }

                const data = await res.json();

                // Store in cache if applicable
                if (cacheKey) _cache.set(cacheKey, { data, expiresAt: Date.now() + cacheTtl });

                return data;
            } catch (err) {
                lastError = err;
                // Don't retry auth errors or 4xx client errors
                if (err instanceof APIError && err.status >= 400 && err.status < 500) break;
            }
        }
        throw lastError;
    };

    const promise = execute().finally(() => _inflight.delete(dedupKey));
    _inflight.set(dedupKey, promise);
    return promise;
}

// ── STRUCTURED ERROR ──────────────────────────────────────────────────────────
export class APIError extends Error {
    constructor(message, code = 'UNKNOWN', status = 0) {
        super(message);
        this.name = 'APIError';
        this.code = code;
        this.status = status;
    }
}

// ── INVALIDATE CACHE ──────────────────────────────────────────────────────────
export function invalidateCache(pathPrefix = '') {
    for (const key of _cache.keys()) {
        if (key.includes(pathPrefix)) _cache.delete(key);
    }
}

// ── PUBLIC API SURFACE ────────────────────────────────────────────────────────
export const API = {

    // ── Auth ──────────────────────────────────────────────────────────────────

    /** Legacy password-based admin login */
    async login(password) {
        const data = await _req('/login', {
            method: 'POST',
            body: JSON.stringify({ password }),
        });
        if (data.token) _storeToken(data.token);
        return data;
    },

    /** Token-based login (extension / manual) */
    async loginWithToken(token) {
        _storeToken(token);
        try {
            const data = await this.getUserMe();
            return data;
        } catch (e) {
            _clearToken();
            throw e;
        }
    },

    logout() {
        _clearToken();
        _cache.clear();
        STATE.user = null;
        STATE.isAdmin = false;
    },

    // ── User ──────────────────────────────────────────────────────────────────

    async getUserMe() {
        return _req('/user/me');
    },

    async saveUserSettings(settings) {
        return _req('/user/settings', {
            method: 'PUT',
            body: JSON.stringify(settings),
        });
    },

    async generateApiKey() {
        return _req('/user/generate-api-key', { method: 'POST' });
    },

    // ── Stats ─────────────────────────────────────────────────────────────────

    /** Main dashboard stats (cached 30s) */
    async getStats() {
        return _req('/stats', {}, { cache: true, cacheTtl: 30_000 });
    },

    async getCategoryStats() {
        return _req('/stats/categories', {}, { cache: true, cacheTtl: 60_000 });
    },

    async getExtensionStats(hours = 24) {
        return _req(`/stats/extension?hours=${hours}`, {}, { cache: true, cacheTtl: 60_000 });
    },

    // ── Deals ─────────────────────────────────────────────────────────────────

    async getDeals({ page = 1, limit = CONFIG.DEALS_PER_PAGE, minDiscount = 0, sort = 'smart', chatId = '' } = {}) {
        const qs = new URLSearchParams({ page, limit, sort, minDiscount });
        if (chatId) qs.set('chatId', chatId);
        return _req(`/deals?${qs}`);
    },

    async getMyDeals() {
        return _req('/deals?mine=1');
    },

    async getDealOpportunities(limit = 8) {
        return _req(`/analytics/deal-opportunities?limit=${limit}`, {}, { cache: true, cacheTtl: 60_000 });
    },

    async getBestDrops(limit = 5, hours = 24) {
        return _req(`/analytics/best-drops?limit=${limit}&hours=${hours}`, {}, { cache: true, cacheTtl: 30_000 });
    },

    // ── Products ──────────────────────────────────────────────────────────────

    async getRecent() {
        return _req('/recent', {}, { cache: true, cacheTtl: 20_000 });
    },

    async getTopTracked() {
        return _req('/top-tracked', {}, { cache: true, cacheTtl: 60_000 });
    },

    async getUserProducts() {
        return _req('/products/user');
    },

    /** Preview product before adding */
    async previewProduct(url) {
        return _req('/products/preview', {
            method: 'POST',
            body: JSON.stringify({ url }),
        });
    },

    /** Add a product to tracking */
    async addProduct({ url, threshold = 0, mode = 'price', chatId }) {
        invalidateCache('/stats');
        invalidateCache('/deals');
        return _req('/products', {
            method: 'POST',
            body: JSON.stringify({ url, threshold, mode, chatId }),
        });
    },

    async bulkImport(urls) {
        invalidateCache('/stats');
        return _req('/products/bulk', {
            method: 'POST',
            body: JSON.stringify({ urls }),
        });
    },

    async updateTags(asin, tags) {
        return _req(`/products/${asin}/tags`, {
            method: 'PUT',
            body: JSON.stringify({ tags }),
        });
    },

    async updateTargetPrice(asin, targetPrice) {
        return _req(`/products/${asin}/target`, {
            method: 'PUT',
            body: JSON.stringify({ targetPrice }),
        });
    },

    async archiveProduct(asin, archived = true) {
        return _req(`/products/${asin}/archive`, {
            method: 'PUT',
            body: JSON.stringify({ archived }),
        });
    },

    async deleteProduct(asin) {
        invalidateCache('/deals');
        return _req(`/products/${asin}`, { method: 'DELETE' });
    },

    // ── History & Analytics ───────────────────────────────────────────────────

    async getHistory(asin) {
        return _req(`/history/${asin}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    async getForecast(asin) {
        return _req(`/analytics/forecast/${asin}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    async getVolatility(asin) {
        return _req(`/analytics/volatility/${asin}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    async getBestDay(asin) {
        return _req(`/analytics/best-day/${asin}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    async getStockHistory(asin) {
        return _req(`/analytics/stock-history/${asin}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    /**
     * Fetch ALL analytics for a product in parallel.
     * Returns a merged object. Each key falls back gracefully on failure.
     */
    async getAllProductAnalytics(asin) {
        const [
            historyRes,
            forecastRes,
            volatilityRes,
            bestDayRes,
            stockHistoryRes,
            dealIntelRes,
        ] = await Promise.allSettled([
            this.getHistory(asin),
            this.getForecast(asin),
            this.getVolatility(asin),
            this.getBestDay(asin),
            this.getStockHistory(asin),
            this.getDealIntelligence(asin, false),
        ]);

        return {
            history: historyRes.status === 'fulfilled' ? historyRes.value : null,
            forecast: forecastRes.status === 'fulfilled' ? forecastRes.value : null,
            volatility: volatilityRes.status === 'fulfilled' ? volatilityRes.value : null,
            bestDay: bestDayRes.status === 'fulfilled' ? bestDayRes.value : null,
            stockHistory: stockHistoryRes.status === 'fulfilled' ? stockHistoryRes.value : [],
            dealIntelligence: dealIntelRes.status === 'fulfilled' ? dealIntelRes.value : null,
        };
    },

    async getDealIntelligence(asin, narrative = false) {
        const qs = narrative ? '?narrative=1' : '';
        return _req(`/analytics/deal-intelligence/${asin}${qs}`, {}, { cache: true, cacheTtl: CONFIG.HISTORY_CACHE_TTL_MS });
    },

    async getTrendOverview(days = 7) {
        return _req(`/analytics/trend-overview?days=${days}`, {}, { cache: true, cacheTtl: 60_000 });
    },

    async getTopCategories(limit = 5, sort = 'count') {
        return _req(`/analytics/top-categories?limit=${limit}&sort=${encodeURIComponent(sort)}`, {}, { cache: true, cacheTtl: 60_000 });
    },

    // ── Search ────────────────────────────────────────────────────────────────

    async search(query) {
        if (!query || query.length < 2) return [];
        return _req(`/search?q=${encodeURIComponent(query)}`);
    },

    // ── System / Health ───────────────────────────────────────────────────────

    /** Public endpoint — no auth required */
    async getHealth() {
        return _req('/health', { headers: {} });   // Explicitly no auth override
    },

    async getDbStats() {
        return _req('/system/db-stats', {}, { cache: true, cacheTtl: 30_000 });
    },

    async getQueueStats() {
        return _req('/system/queue', {}, { cache: true, cacheTtl: 15_000 });
    },

    async getSystemMetrics() {
        return _req('/system/metrics', {}, { cache: true, cacheTtl: 15_000 });
    },

    async getLogs({ level = 'all', search = '', limit = 300 } = {}) {
        const qs = new URLSearchParams();
        if (level && level !== 'all') qs.set('level', level);
        if (search) qs.set('search', search);
        qs.set('limit', String(limit));
        return _req(`/logs?${qs}`);
    },

    // ── Admin ─────────────────────────────────────────────────────────────────

    async getAdminStats() {
        return _req('/admin/stats');
    },

    async triggerPriceCheck() {
        invalidateCache('/deals');
        return _req('/admin/check-prices', { method: 'POST' });
    },

    async triggerScrapeAll() {
        return _req('/admin/scrape-all', { method: 'POST' });
    },

    async broadcastMessage(message) {
        return _req('/admin/broadcast', {
            method: 'POST',
            body: JSON.stringify({ message }),
        });
    },

    // ── Exports ───────────────────────────────────────────────────────────────

    getExportUrl(type) {
        return `/api/export/${type}`;
    },

    async downloadCSV() {
        const token = _getToken();
        const url = this.getExportUrl('csv') + (token ? `?token=${token}` : '');
        const a = document.createElement('a');
        a.href = url;
        a.download = `trackzoon-export-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    },

    getRSSUrl() {
        return window.location.origin + this.getExportUrl('rss');
    },

    openPDFReport() {
        window.open(this.getExportUrl('pdf'), '_blank');
    },

    // ── Extension ─────────────────────────────────────────────────────────────

    async getExtensionStatus(asin) {
        return _req(`/v1/extension/status?asin=${asin}`);
    },

    // ── Utility ───────────────────────────────────────────────────────────────

    /** Check if there is a valid stored token (without making a network call) */
    hasToken() {
        return Boolean(_getToken());
    },

    storeToken: _storeToken,
    clearToken: _clearToken,
};
