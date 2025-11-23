import { STATE } from './config.js';

export const API = {
    async getStats() {
        const res = await fetch('/api/stats');
        return res.json();
    },

    async getDeals(page = 1, limit = 20, minDiscount = 0, sort = 'smart') {
        // Sort is now passed as an argument, defaulting to 'smart'
        const res = await fetch(`/api/deals?page=${page}&limit=${limit}&sort=${sort}&minDiscount=${minDiscount}`);
        return res.json();
    },

    async getRecent() {
        const res = await fetch('/api/recent');
        return res.json();
    },

    async getTopTracked() {
        const res = await fetch('/api/top-tracked');
        return res.json();
    },

    async getHealth() {
        const res = await fetch('/api/health');
        return res.json();
    },

    async getCategoryStats() {
        const res = await fetch('/api/stats/categories');
        return res.json();
    },

    async getLogs() {
        const res = await fetch('/api/logs');
        return res.json();
    },

    async getHistory(asin) {
        const res = await fetch(`/api/history/${asin}`);
        return res.json();
    },

    async search(query) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        return res.json();
    },

    async getForecast(asin) {
        const res = await fetch(`/api/analytics/forecast/${asin}`);
        return res.json();
    },

    async getVolatility(asin) {
        const res = await fetch(`/api/analytics/volatility/${asin}`);
        return res.json();
    },

    async getBestDay(asin) {
        const res = await fetch(`/api/analytics/best-day/${asin}`);
        return res.json();
    },

    async getStockHistory(asin) {
        const res = await fetch(`/api/analytics/stock-history/${asin}`);
        return res.json();
    },

    async getStockHistory(asin) {
        const res = await fetch(`/api/analytics/stock-history/${asin}`);
        return res.json();
    },

    async bulkImport(urls) {
        const res = await fetch('/api/products/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ urls })
        });
        return res.json();
    },

    async updateTags(asin, tags) {
        const res = await fetch(`/api/products/${asin}/tags`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tags })
        });
        return res.json();
    },

    async updateTargetPrice(asin, targetPrice) {
        const res = await fetch(`/api/products/${asin}/target`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targetPrice })
        });
        return res.json();
    },

    async archiveProduct(asin, isArchived) {
        const res = await fetch(`/api/products/${asin}/archive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived })
        });
        return res.json();
    },

    async archiveProduct(asin, isArchived) {
        const res = await fetch(`/api/products/${asin}/archive`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isArchived })
        });
        return res.json();
    },

    async getSystemHealth() {
        const res = await fetch('/api/system/health');
        return res.json();
    },

    async getDbStats() {
        const res = await fetch('/api/system/db-stats');
        return res.json();
    },

    async getQueueStatus() {
        const res = await fetch('/api/system/queue');
        return res.json();
    },

    async getSystemMetrics(type) {
        const res = await fetch(`/api/system/metrics?type=${type}`);
        return res.json();
    },

    async getSettings() {
        const res = await fetch('/api/user/settings');
        return res.json();
    },

    async updateSettings(webhookUrl) {
        const res = await fetch('/api/user/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ webhookUrl })
        });
        return res.json();
    },

    async generateApiKey() {
        const res = await fetch('/api/user/apikey', { method: 'POST' });
        return res.json();
    },

    async addProduct(url, threshold = 0) {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, threshold })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add product');
        return data;
    }
};
