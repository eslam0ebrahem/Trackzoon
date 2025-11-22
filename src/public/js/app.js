import { CONFIG, STATE } from './config.js';
import { API } from './api.js';
import { UI } from './ui.js';
import { initCharts, updateCategoryChart } from './charts.js';
import { shareDeal, debounce } from './utils.js';

// Expose global functions for HTML onclick attributes
window.shareDeal = shareDeal;
window.loadHistory = loadHistory;
window.toggleCurrency = toggleCurrency;
window.toggleView = toggleView;
window.setSort = setSort;
window.setFilter = setFilter;
window.toggleLogs = toggleLogs;
window.openAddProductModal = UI.openAddProductModal;
window.closeAddProductModal = UI.closeAddProductModal;
window.submitNewProduct = submitNewProduct;
window.downloadCSV = downloadCSV;

async function init() {
    initCharts();
    await Promise.all([
        fetchStats(),
        fetchDeals(),
        fetchRecent(),
        fetchTopTracked(),
        fetchHealth(),
        fetchCategoryStats(),
        fetchMerchantStats() // Assuming this exists or remove if not
    ]);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            localStorage.theme = 'light';
        } else {
            document.documentElement.classList.add('dark');
            localStorage.theme = 'dark';
        }
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }
        try {
            const results = await API.search(query);
            if (results.length > 0) {
                searchResults.innerHTML = results.map(p => `
                    <div class="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer flex items-center justify-between" onclick="window.loadHistory('${p.asin}'); document.getElementById('searchResults').classList.add('hidden');">
                        <span class="text-sm text-gray-700 dark:text-gray-200 truncate w-64">${p.name}</span>
                        <span class="text-xs font-bold text-gray-500 dark:text-gray-400">EGP ${p.currentPrice}</span>
                    </div>
                `).join('');
                searchResults.classList.remove('hidden');
            } else {
                searchResults.innerHTML = '<div class="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">No results found</div>';
                searchResults.classList.remove('hidden');
            }
        } catch (e) { console.error('Search error:', e); }
    }, 300));

    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.classList.add('hidden');
        }
    });

    setInterval(init, 60000);
}

async function fetchStats() {
    try {
        const data = await API.getStats();
        UI.renderStats(data);
    } catch (e) { console.error('Error fetching stats:', e); }
}

async function fetchCategoryStats() {
    try {
        const data = await API.getCategoryStats();
        updateCategoryChart(data.labels, data.data);
    } catch (e) { console.error('Error fetching category stats:', e); }
}

async function fetchMerchantStats() {
    // Placeholder if not implemented
}

export async function fetchDeals(page = 1) {
    if (STATE.isLoadingDeals) return;
    STATE.isLoadingDeals = true;
    STATE.currentPage = page;

    try {
        const data = await API.getDeals(page, 10);
        let deals = data.items;
        const container = document.getElementById('dealsList');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        // Client-side Filter
        if (STATE.currentFilter > 0) {
            deals = deals.filter(d => d.percentChange >= STATE.currentFilter);
        }

        // Client-side Sort
        if (STATE.currentSort === 'discount') {
            deals.sort((a, b) => b.percentChange - a.percentChange);
        } else if (STATE.currentSort === 'price_asc') {
            deals.sort((a, b) => a.currentPrice - b.currentPrice);
        } else if (STATE.currentSort === 'price_desc') {
            deals.sort((a, b) => b.currentPrice - a.currentPrice);
        } else if (STATE.currentSort === 'date') {
            deals.sort((a, b) => b.dealScore - a.dealScore);
        }

        if (page === 1) {
            UI.renderDeals(deals, container, false);
            if (deals.length === 0) {
                container.innerHTML = '<div class="p-8 text-center text-gray-500 dark:text-gray-400 col-span-full">No deals match your filter.</div>';
            }
            // Initial chart load
            if (deals.length > 0 && !STATE.currentAsin) {
                loadHistory(deals[0].product.asin);
            }
        } else {
            UI.renderDeals(deals, container, true);
        }

        // Handle Load More Button
        if (!loadMoreBtn) {
            const btnHtml = `<div class="p-4 text-center col-span-full"><button id="loadMoreBtn" onclick="fetchDeals(${page + 1})" class="text-sm text-blue-600 hover:underline">Load More</button></div>`;
            container.parentElement.insertAdjacentHTML('beforeend', btnHtml);
        } else {
            if (deals.length === 0 || page >= data.totalPages) {
                loadMoreBtn.parentElement.style.display = 'none';
            } else {
                loadMoreBtn.parentElement.style.display = 'block';
                loadMoreBtn.onclick = () => fetchDeals(page + 1);
            }
        }

    } catch (e) { console.error('Error fetching deals:', e); } finally {
        STATE.isLoadingDeals = false;
    }
}

async function fetchRecent() {
    try {
        const products = await API.getRecent();
        UI.renderRecent(products);
        UI.updateTicker(products);
    } catch (e) { console.error('Error fetching recent:', e); }
}

async function fetchTopTracked() {
    try {
        const products = await API.getTopTracked();
        UI.renderTopTracked(products);
    } catch (e) { console.error('Error fetching top tracked:', e); }
}

async function fetchHealth() {
    try {
        const data = await API.getHealth();
        UI.updateHealth(data);
    } catch (e) {
        console.error('Error fetching health:', e);
        UI.updateHealthError();
    }
}

async function loadHistory(asin) {
    try {
        const data = await API.getHistory(asin);
        UI.showProductHistory(data, asin);
    } catch (e) { console.error('Error loading history:', e); }
}

function toggleCurrency() {
    STATE.currentCurrency = STATE.currentCurrency === 'EGP' ? 'USD' : 'EGP';
    document.getElementById('currencyToggle').textContent = STATE.currentCurrency;
    fetchDeals(STATE.currentPage);
    if (STATE.currentAsin) loadHistory(STATE.currentAsin);
    fetchRecent();
    fetchTopTracked();
}

function toggleView(view) {
    STATE.currentView = view;

    // Update UI classes manually or via UI helper
    const listBtn = document.getElementById('view-list');
    const gridBtn = document.getElementById('view-grid');
    const listContainer = document.getElementById('dealsList');

    if (view === 'list') {
        listBtn.classList.replace('text-gray-500', 'bg-white'); // Simplified logic, better to use full class swap
        // Re-using logic from original file for simplicity of porting
        listBtn.className = "p-1 rounded bg-white dark:bg-gray-600 shadow-sm text-gray-700 dark:text-gray-200";
        gridBtn.className = "p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 transition";

        listContainer.classList.add('divide-y', 'divide-gray-100', 'dark:divide-gray-700');
        listContainer.classList.remove('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4');
    } else {
        gridBtn.className = "p-1 rounded bg-white dark:bg-gray-600 shadow-sm text-gray-700 dark:text-gray-200";
        listBtn.className = "p-1 rounded text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 transition";

        listContainer.classList.remove('divide-y', 'divide-gray-100', 'dark:divide-gray-700');
        listContainer.classList.add('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'gap-4');
    }

    fetchDeals(STATE.currentPage);
}

function setSort(sortValue) {
    STATE.currentSort = sortValue;
    STATE.currentPage = 1;
    fetchDeals(1);
}

function setFilter(minDiscount) {
    STATE.currentFilter = minDiscount;
    STATE.currentPage = 1;

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn px-3 py-1 text-xs font-medium rounded-md text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 hover:shadow-sm transition";
    });
    const activeBtn = document.getElementById(`filter-${minDiscount}`);
    activeBtn.className = "filter-btn px-3 py-1 text-xs font-medium rounded-md bg-white dark:bg-gray-600 text-gray-700 dark:text-gray-200 shadow-sm transition";

    fetchDeals(1);
}

function toggleLogs() {
    if (UI.toggleLogs()) {
        fetchLogs();
    }
}

async function fetchLogs() {
    try {
        const data = await API.getLogs();
        UI.renderLogs(data);
    } catch (e) {
        document.getElementById('logsList').innerHTML = '<div class="text-red-400">Failed to load logs</div>';
    }
}

async function submitNewProduct() {
    const url = document.getElementById('newProductUrl').value;
    const btn = document.getElementById('submitProductBtn');

    if (!url) {
        alert('Please enter a valid Amazon URL');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Tracking...`;

    try {
        await API.addProduct(url);
        UI.closeAddProductModal();
        alert('Product added successfully!');
        fetchStats();
        fetchRecent();
        fetchDeals();
    } catch (e) {
        console.error('Error adding product:', e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Track</span>';
    }
}

async function downloadCSV() {
    if (!STATE.currentAsin) return;
    try {
        const data = await API.getHistory(STATE.currentAsin);
        if (!data.history || data.history.length === 0) return;

        const headers = ['Date', 'Price (EGP)'];
        const rows = data.history.map(h => [
            new Date(h.date).toISOString(),
            h.price
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `price_history_${STATE.currentAsin}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (e) { console.error('Error downloading CSV:', e); }
}

// Start App
init();
