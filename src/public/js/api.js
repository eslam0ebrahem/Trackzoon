export const API = {
    async getStats() {
        const res = await fetch('/api/stats');
        return res.json();
    },

    async getDeals(page = 1, limit = 10) {
        const res = await fetch(`/api/deals?page=${page}&limit=${limit}`);
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

    async addProduct(url) {
        const res = await fetch('/api/products', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to add product');
        return data;
    }
};
