import { STATE } from './config.js';

export const API = {
    async login(password) {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Login failed');
        return data;
    },

    // Helper to get headers with token
    getHeaders() {
        const headers = { 'Content-Type': 'application/json' };
        let token = null;
        try {
            token = localStorage.getItem('token');
        } catch (e) {
            // Check in-memory state if storage failed
            if (window.state && window.state.token) token = window.state.token;
        }

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    },

    async getStats() {
        const res = await fetch('/api/stats', { headers: this.getHeaders() });
        return res.json();
    },

    async getDeals(page = 1, limit = 20, minDiscount = 0, sort = 'smart') {
        const res = await fetch(`/api/deals?page=${page}&limit=${limit}&sort=${sort}&minDiscount=${minDiscount}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getRecent() {
        const res = await fetch('/api/recent', { headers: this.getHeaders() });
        return res.json();
    },

    async getTopTracked() {
        const res = await fetch('/api/top-tracked', { headers: this.getHeaders() });
        return res.json();
    },

    async getExtensionStats(hours = 24) {
        const res = await fetch(`/api/stats/extension?hours=${hours}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getHealth() {
        const res = await fetch('/api/health'); // Public endpoint
        return res.json();
    },

    async triggerPriceCheck() {
        const res = await fetch('/api/admin/check-prices', {
            method: 'POST',
            headers: this.getHeaders()
        });
        return res.json();
    },

    async getCategoryStats() {
        const res = await fetch('/api/stats/categories', { headers: this.getHeaders() });
        return res.json();
    },

    async getLogs(level = 'all', search = '', limit = 300) {
        const params = new URLSearchParams();
        if (level) params.set('level', level);
        if (search) params.set('search', search);
        if (limit) params.set('limit', String(limit));
        const query = params.toString();

        const res = await fetch(`/api/logs${query ? `?${query}` : ''}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getHistory(asin) {
        const res = await fetch(`/api/history/${asin}`, { headers: this.getHeaders() });
        return res.json();
    },

    async search(query) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getForecast(asin) {
        const res = await fetch(`/api/analytics/forecast/${asin}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getVolatility(asin) {
        const res = await fetch(`/api/analytics/volatility/${asin}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getBestDay(asin) {
        const res = await fetch(`/api/analytics/best-day/${asin}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getStockHistory(asin) {
        const res = await fetch(`/api/analytics/stock-history/${asin}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getDealIntelligence(asin, narrative = false) {
        const query = narrative ? '?narrative=1' : '';
        const res = await fetch(`/api/analytics/deal-intelligence/${asin}${query}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getDealOpportunities(limit = 8) {
        const res = await fetch(`/api/analytics/deal-opportunities?limit=${limit}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getBestDrops(limit = 5, hours = 24) {
        const res = await fetch(`/api/analytics/best-drops?limit=${limit}&hours=${hours}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getTrendOverview(days = 7) {
        const res = await fetch(`/api/analytics/trend-overview?days=${days}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getTopCategories(limit = 5, sort = 'count') {
        const res = await fetch(`/api/analytics/top-categories?limit=${limit}&sort=${encodeURIComponent(sort)}`, { headers: this.getHeaders() });
        return res.json();
    },

    async bulkImport(urls) {
        const res = await fetch('/api/products/bulk', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ urls })
        });
        return res.json();
    },

    async updateTags(asin, tags) {
        const res = await fetch(`/api/products/${asin}/tags`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ tags })
        });
        return res.json();
    },

    async updateTargetPrice(asin, targetPrice) {
        const res = await fetch(`/api/products/${asin}/target`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ targetPrice })
        });
        return res.json();
    },

    async archiveProduct(asin, isArchived) {
        const res = await fetch(`/api/products/${asin}/archive`, {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ isArchived })
        });
        return res.json();
    },

    async getSystemHealth() {
        const res = await fetch('/api/system/health', { headers: this.getHeaders() });
        return res.json();
    },

    async getDbStats() {
        const res = await fetch('/api/system/db-stats', { headers: this.getHeaders() });
        return res.json();
    },

    async getQueueStatus() {
        const res = await fetch('/api/system/queue', { headers: this.getHeaders() });
        return res.json();
    },

    async getSystemMetrics(type) {
        const res = await fetch(`/api/system/metrics?type=${type}`, { headers: this.getHeaders() });
        return res.json();
    },

    async getAiBudget() {
        const res = await fetch('/api/system/ai-budget', { headers: this.getHeaders() });
        return res.json();
    },

    async getSettings() {
        const res = await fetch('/api/user/settings', { headers: this.getHeaders() });
        return res.json();
    },

    async updateSettings(webhookUrl) {
        const res = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: this.getHeaders(),
            body: JSON.stringify({ webhookUrl })
        });
        return res.json();
    },

    async generateApiKey() {
        const res = await fetch('/api/user/apikey', {
            method: 'POST',
            headers: this.getHeaders()
        });
        return res.json();
    },

    async getUserProducts() {
        const res = await fetch('/api/products/user', { headers: this.getHeaders() });
        return res.json();
    },

    async adminScrapeAll() {
        const res = await fetch('/api/admin/scrape-all', {
            method: 'POST',
            headers: this.getHeaders()
        });
        return res.json();
    },

    async adminBroadcast(message) {
        const res = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ message })
        });
        return res.json();
    },

    async addProduct(url, threshold = 0) {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ url, threshold })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add product');
        return data;
    }
};
