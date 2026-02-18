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
window.fetchDeals = fetchDeals; // Expose for UI if needed
// Management Functions
window.openImportModal = () => document.getElementById('importModal').classList.remove('hidden');
window.closeImportModal = () => document.getElementById('importModal').classList.add('hidden');

window.submitImport = async () => {
    const btn = document.querySelector('#importModal button:last-child');
    const originalText = btn.innerHTML;
    const urls = document.getElementById('importUrls').value.split('\n').map(u => u.trim()).filter(u => u);

    if (urls.length === 0) return alert('Please enter at least one URL');

    btn.innerHTML = 'Importing...';
    btn.disabled = true;

    try {
        const res = await API.bulkImport(urls);
        alert(`Imported: ${res.success}, Failed: ${res.failed}`);
        window.closeImportModal();
        document.getElementById('importUrls').value = '';
        init(); // Refresh
    } catch (e) {
        alert('Error importing products');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
};

window.saveTags = async () => {
    const tags = document.getElementById('productTags').value.split(',').map(t => t.trim()).filter(t => t);
    try {
        await API.updateTags(STATE.currentAsin, tags);
        alert('Tags updated!');
    } catch (e) { alert('Error updating tags'); }
};

window.saveTargetPrice = async () => {
    const price = parseFloat(document.getElementById('productTargetPrice').value);
    if (isNaN(price)) return alert('Invalid price');
    try {
        await API.updateTargetPrice(STATE.currentAsin, price);
        alert('Target price updated!');
    } catch (e) { alert('Error updating target price'); }
};

window.toggleArchive = async () => {
    const btn = document.getElementById('archiveBtn');
    const isArchived = btn.textContent.trim() === 'Unarchive';
    try {
        await API.archiveProduct(STATE.currentAsin, !isArchived);
        btn.textContent = !isArchived ? 'Unarchive' : 'Archive';
        btn.className = !isArchived
            ? 'bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors'
            : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg font-medium transition-colors';
        alert(!isArchived ? 'Product archived' : 'Product unarchived');
    } catch (e) { alert('Error updating archive status'); }
};

window.toggleSystemDashboard = async () => {
    const dashboard = document.getElementById('systemDashboard');
    const isHidden = dashboard.classList.contains('hidden');

    if (isHidden) {
        dashboard.classList.remove('hidden');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
        await updateSystemStats();
        fetchLogs(); // Fetch logs when dashboard opens
    } else {
        dashboard.classList.add('hidden');
        document.body.style.overflow = '';
    }
};

window.triggerPriceCheck = async () => {
    const btn = document.getElementById('checkPricesBtn');
    const originalText = btn.innerHTML;

    if (!confirm('Start manual price check for all products? This may take a while.')) return;

    btn.disabled = true;
    btn.innerHTML = `<svg class="animate-spin w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> Checking...`;

    try {
        const res = await API.triggerPriceCheck();
        if (res.error) throw new Error(res.error);
        alert('Price check started! Monitor the "Job Queue" or "System Logs" for progress.');
    } catch (e) {
        alert('Error starting price check: ' + e.message);
    } finally {
        // Re-enable after 5 seconds to prevent spam
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }, 5000);
    }
};

async function updateSystemStats() {
    try {
        const [health, dbStats, aiBudget, extensionStats] = await Promise.all([
            API.getSystemHealth(),
            API.getDbStats(),
            API.getAiBudget(),
            API.getExtensionStats(24)
        ]);

        // Update Server Health
        document.getElementById('sysUptime').textContent = `${(health.uptime / 3600).toFixed(1)} hrs`;
        document.getElementById('sysMemory').textContent = `${health.memory.heapUsed} MB`;

        // Update DB Stats
        document.getElementById('dbSize').textContent = dbStats.storageSize;
        document.getElementById('dbProducts').textContent = dbStats.collections.products;
        document.getElementById('dbMetrics').textContent = dbStats.collections.metrics;

        // Update Scraper Stats
        if (health.scraper) {
            document.getElementById('scrapeSuccess').textContent = health.scraper.succeeded;
            document.getElementById('scrapeFailed').textContent = health.scraper.failed;
            document.getElementById('scrapeUnchanged').textContent = health.scraper.unchanged;
        }

        // Update AI Budget
        const aiStatusEl = document.getElementById('aiBudgetStatus');
        const aiTokensEl = document.getElementById('aiTokensUsage');
        const aiRequestsEl = document.getElementById('aiRequestsUsage');
        const aiPauseEl = document.getElementById('aiPauseStatus');

        if (aiStatusEl && aiTokensEl && aiRequestsEl && aiPauseEl && aiBudget && !aiBudget.error) {
            const formatNumber = (value) => Number(value || 0).toLocaleString();
            const tokenLimit = aiBudget?.limits?.tokens;
            const requestLimit = aiBudget?.limits?.requests;
            const tokenPercent = typeof aiBudget?.usagePercent?.tokens === 'number' ? `${aiBudget.usagePercent.tokens}%` : 'n/a';
            const requestPercent = typeof aiBudget?.usagePercent?.requests === 'number' ? `${aiBudget.usagePercent.requests}%` : 'n/a';

            aiStatusEl.textContent = aiBudget.paused ? 'Paused' : 'Active';
            aiTokensEl.textContent = tokenLimit
                ? `${formatNumber(aiBudget.usage.tokens)} / ${formatNumber(tokenLimit)} (${tokenPercent})`
                : `${formatNumber(aiBudget.usage.tokens)} / unlimited`;
            aiRequestsEl.textContent = requestLimit
                ? `${formatNumber(aiBudget.usage.requests)} / ${formatNumber(requestLimit)} (${requestPercent})`
                : `${formatNumber(aiBudget.usage.requests)} / unlimited`;
            aiPauseEl.textContent = aiBudget.paused
                ? `${Math.max(0, aiBudget.pauseRemainingSeconds || 0)}s remaining`
                : 'None';
        }

        // Update Extension Pipeline
        const extTotalEl = document.getElementById('extSyncTotal');
        const extSuccessEl = document.getElementById('extSyncSuccess');
        const extFailEl = document.getElementById('extSyncFailed');
        const extCorrectedEl = document.getElementById('extAiCorrected');
        const extDurationEl = document.getElementById('extAvgDuration');
        const extLastSyncEl = document.getElementById('extLastSync');
        const extTopReasonEl = document.getElementById('extTopReason');

        if (
            extTotalEl && extSuccessEl && extFailEl && extCorrectedEl &&
            extDurationEl && extLastSyncEl && extTopReasonEl &&
            extensionStats && !extensionStats.error
        ) {
            extTotalEl.textContent = String(extensionStats.total ?? 0);
            extSuccessEl.textContent = String(extensionStats.successes ?? 0);
            extFailEl.textContent = String(extensionStats.failures ?? 0);
            extCorrectedEl.textContent = String(extensionStats.aiCorrected ?? 0);
            extDurationEl.textContent = `${extensionStats.avgDurationMs ?? 0} ms`;

            if (extensionStats.lastSyncAt) {
                const lastSyncDate = new Date(extensionStats.lastSyncAt);
                extLastSyncEl.textContent = Number.isNaN(lastSyncDate.getTime())
                    ? '-'
                    : lastSyncDate.toLocaleString();
            } else {
                extLastSyncEl.textContent = '-';
            }

            const topReason = Array.isArray(extensionStats.topAvailabilityReasons) && extensionStats.topAvailabilityReasons.length > 0
                ? extensionStats.topAvailabilityReasons[0]
                : null;
            extTopReasonEl.textContent = topReason
                ? `${topReason.reason} (${topReason.count})`
                : 'None';
        }
    } catch (e) { console.error('Error updating system stats:', e); }
}

// Settings Functions
window.openSettingsModal = async () => {
    document.getElementById('settingsModal').classList.remove('hidden');
    try {
        const settings = await API.getSettings();
        document.getElementById('webhookUrl').value = settings.webhookUrl || '';
        document.getElementById('apiKey').value = settings.apiKey || '';
    } catch (e) { console.error('Error loading settings:', e); }
};

window.closeSettingsModal = () => document.getElementById('settingsModal').classList.add('hidden');

window.saveSettings = async () => {
    const webhookUrl = document.getElementById('webhookUrl').value;
    try {
        await API.updateSettings(webhookUrl);
        alert('Settings saved!');
        window.closeSettingsModal();
    } catch (e) { alert('Error saving settings'); }
};

window.generateApiKey = async () => {
    if (!confirm('Generate new API Key? This will invalidate the old one.')) return;
    try {
        const res = await API.generateApiKey();
        document.getElementById('apiKey').value = res.apiKey;
    } catch (e) { alert('Error generating API Key'); }
};

// Feature 16: Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
    // '/' to focus search
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        document.getElementById('searchInput').focus();
    }
    // 'Esc' to close modals
    if (e.key === 'Escape') {
        UI.closeAddProductModal();
        window.closeImportModal();
        window.toggleSystemDashboard(); // Close if open
    }
    // 'n' to open Add Product (if not typing)
    if (e.key === 'n' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        UI.openAddProductModal();
    }
});

// Feature 14: Saved Filters
window.saveCurrentView = () => {
    const view = {
        sort: document.getElementById('sortSelect').value,
        filter: STATE.currentFilter, // Use state instead of DOM
        viewMode: STATE.currentView // Use state
    };
    try {
        localStorage.setItem('trackzoon_saved_view', JSON.stringify(view));
    } catch (e) { console.warn('Storage access denied', e); }
    alert('View settings saved!');
};

window.loadSavedView = () => {
    let saved = null;
    try { saved = localStorage.getItem('trackzoon_saved_view'); } catch (e) { }
    if (saved) {
        const view = JSON.parse(saved);
        if (view.sort) {
            document.getElementById('sortSelect').value = view.sort;
            STATE.currentSort = view.sort;
        }
        if (view.filter !== undefined) {
            setFilter(view.filter);
        }
        if (view.viewMode) {
            toggleView(view.viewMode);
        }
        // init() will be called after this in the main flow, so we don't need to call it here if called from init
        // But if called manually, we might want to refresh. 
        // The original code called init(), but loadSavedView is called INSIDE init().
        // Calling init() here would cause infinite recursion if not careful, 
        // but since it's just setting state, it should be fine as long as we don't re-trigger loadSavedView.
        // Actually, init() calls loadSavedView() first.
        // So we should NOT call init() here.
    }
};

// Initialize
export async function init() {
    initCharts();
    loadSavedView(); // Load saved view on startup

    await Promise.all([
        fetchDeals(),
        fetchRecent(),
        fetchTopTracked(),
        fetchCategoryStats(),
        fetchTopCategories(),
        fetchBestDrops(),
        fetchTrendOverview(),
        fetchLogs(), // Initial logs fetch
        fetchStats() // Fetch dashboard stats
    ]);

    // Refresh every 30s
    setInterval(refreshData, 30000);

    // Theme Toggle
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        if (document.documentElement.classList.contains('dark')) {
            document.documentElement.classList.remove('dark');
            try { localStorage.theme = 'light'; } catch (e) { }
        } else {
            document.documentElement.classList.add('dark');
            try { localStorage.theme = 'dark'; } catch (e) { }
        }
    });

    // Search
    const searchInput = document.getElementById('searchInput');
    const searchResults = document.getElementById('searchResults');

    searchInput.addEventListener('input', debounce(async (e) => {
        const query = e.target.value;

        // The original API.search(query) call and subsequent logic
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

    // Auto-refresh full init every 5 mins just in case, but use refreshData for frequent updates
    setInterval(refreshData, 60000);
}

async function refreshData() {
    await Promise.all([
        fetchRecent(),
        fetchLogs(),
        fetchStats(),
        fetchBestDrops(),
        fetchTrendOverview()
    ]);
    if (STATE.currentPage === 1) {
        fetchDeals(1);
    }
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

async function fetchTopCategories() {
    try {
        const data = await API.getTopCategories(5, 'count');
        UI.renderTopCategories(data);
    } catch (e) { console.error('Error fetching top categories:', e); }
}

async function fetchBestDrops() {
    try {
        const data = await API.getBestDrops(5, 24);
        UI.renderBestDrops(data);
    } catch (e) { console.error('Error fetching best drops:', e); }
}

async function fetchTrendOverview() {
    try {
        const data = await API.getTrendOverview(7);
        UI.renderTrendOverview(data);
    } catch (e) { console.error('Error fetching trend overview:', e); }
}

async function fetchMerchantStats() {
    // Placeholder if not implemented
}

export async function fetchDeals(page = 1) {
    if (STATE.isLoadingDeals) return;
    STATE.isLoadingDeals = true;
    STATE.currentPage = page;

    try {
        // Pass filter and sort to API
        const data = await API.getDeals(page, 10, STATE.currentFilter, STATE.currentSort);

        if (data.error) throw new Error(data.error);
        if (!data.items) throw new Error('No items returned');

        let deals = data.items;
        const container = document.getElementById('dealsList');
        const loadMoreBtn = document.getElementById('loadMoreBtn');

        // Client-side sorting removed to rely on server-side sorting
        // which now handles Smart Score, Discount, and Date correctly.

        // Only apply client-side sort if strictly necessary or for fallbacks, 
        // but for now we trust the API.

        /* 
        Legacy Client-Side Sort (Removed):
        if (STATE.currentSort === 'smart') { ... } 
        */

        if (page === 1) {
            UI.renderDeals(deals, container, false);
            if (deals.length === 0) {
                container.innerHTML = `
                    <div class="col-span-full flex flex-col items-center justify-center py-12 text-center">
                        <div class="bg-gray-100 dark:bg-gray-700 rounded-full p-4 mb-4">
                            <svg class="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-1">No deals found</h3>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">Try adjusting your filters or tracking more products.</p>
                    </div>
                `;
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
            if (page < data.totalPages) {
                const btnHtml = `
                    <div class="p-6 text-center col-span-full">
                        <button id="loadMoreBtn" onclick="fetchDeals(${page + 1})" class="px-6 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 hover:shadow-md transition-all duration-200 flex items-center justify-center mx-auto space-x-2 group">
                            <span>Load More Deals</span>
                            <svg class="w-4 h-4 text-gray-400 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </button>
                    </div>`;
                container.parentElement.insertAdjacentHTML('beforeend', btnHtml);
            }
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
        const [historyData, forecast, volatility, bestDay, stockHistory] = await Promise.all([
            API.getHistory(asin),
            API.getForecast(asin),
            API.getVolatility(asin),
            API.getBestDay(asin),
            API.getStockHistory(asin)
        ]);

        UI.showProductHistory(historyData, asin, { forecast, volatility, bestDay, stockHistory });
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

window.toggleSortDropdown = () => {
    const menu = document.getElementById('sortDropdownMenu');
    menu.classList.toggle('hidden');

    // Close on click outside
    if (!menu.classList.contains('hidden')) {
        const closeMenu = (e) => {
            if (!e.target.closest('#sortDropdownMenu') && !e.target.closest('#sortButton')) {
                menu.classList.add('hidden');
                document.removeEventListener('click', closeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
};

window.selectSort = (sortValue, label) => {
    STATE.currentSort = sortValue;
    STATE.currentPage = 1;

    // Update UI
    document.getElementById('currentSortLabel').textContent = label;
    document.getElementById('sortDropdownMenu').classList.add('hidden');

    fetchDeals(1);
};

function setSort(sortValue) {
    // Legacy support or internal use if needed
    selectSort(sortValue, 'Sort');
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
        const levelEl = document.getElementById('logLevelFilter');
        const searchEl = document.getElementById('logSearch');
        const level = levelEl ? levelEl.value : 'all';
        const search = searchEl ? searchEl.value : '';
        const data = await API.getLogs(level, search, 400);
        UI.renderLogs(data);
    } catch (e) {
        document.getElementById('logsList').innerHTML = '<div class="text-red-400">Failed to load logs</div>';
    }
}
window.fetchLogs = fetchLogs;

let searchTimeout;

window.handleUrlInput = (url) => {
    const validationIcon = document.getElementById('urlValidationIcon');
    const preview = document.getElementById('productPreview');
    const loading = document.getElementById('previewLoading');
    const submitBtn = document.getElementById('submitProductBtn');

    // Reset UI
    preview.classList.add('hidden');
    validationIcon.classList.add('hidden');
    submitBtn.disabled = true;

    if (!url || url.length < 10) return;

    // Basic URL validation
    if (!url.includes('amazon') && !url.includes('amzn')) {
        validationIcon.innerHTML = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
        validationIcon.classList.remove('hidden');
        return;
    }

    // Debounce API call
    clearTimeout(searchTimeout);
    loading.classList.remove('hidden');

    searchTimeout = setTimeout(async () => {
        try {
            const res = await fetch('/api/products/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();

            loading.classList.add('hidden');

            if (data.error) throw new Error(data.error);

            // Show Success Icon
            validationIcon.innerHTML = `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
            validationIcon.classList.remove('hidden');

            // Populate Preview
            const placeholder = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjZzRkNGQ0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiPjwvcmVjdD48Y2lyY2xlIGN4PSI4LjUiIGN5PSI4LjUiIHI9IjEuNSI+PC9jaXJjbGU+PHBvbHlsaW5lIHBvaW50cz0iMjEgMTUgMTYgMTAgNSAyMSI+PC9wb2x5bGluZT48L3N2Zz4=';

            const img = document.getElementById('previewImage');
            img.src = data.imageUrl || placeholder;
            img.onerror = () => { img.src = placeholder; };

            document.getElementById('previewTitle').textContent = data.name;
            document.getElementById('previewPrice').textContent = `EGP ${data.currentPrice}`;

            // Smart Target: Default to 10% off
            const target = Math.floor(data.currentPrice * 0.9);
            document.getElementById('targetPriceInput').value = target;

            // Show Preview
            preview.classList.remove('hidden');
            submitBtn.disabled = false;

        } catch (e) {
            loading.classList.add('hidden');
            validationIcon.innerHTML = `<svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
            validationIcon.classList.remove('hidden');
            console.error(e);
        }
    }, 800);
};

window.setSmartTarget = (percent) => {
    const priceText = document.getElementById('previewPrice').textContent;
    const price = parseFloat(priceText.replace(/[^0-9.]/g, ''));
    if (price) {
        document.getElementById('targetPriceInput').value = Math.floor(price * (1 - percent));
    }
};

async function submitNewProduct() {
    const url = document.getElementById('newProductUrl').value;
    const targetPrice = document.getElementById('targetPriceInput').value;
    const btn = document.getElementById('submitProductBtn');

    if (!url) return;

    btn.disabled = true;
    btn.innerHTML = 'Adding...';

    try {
        await API.addProduct(url, targetPrice || 0);

        UI.closeAddProductModal();
        // Reset Modal
        document.getElementById('newProductUrl').value = '';
        document.getElementById('targetPriceInput').value = '';
        document.getElementById('productPreview').classList.add('hidden');
        document.getElementById('urlValidationIcon').classList.add('hidden');

        alert('Product added successfully!');
        fetchStats();
        fetchRecent();
        fetchDeals();
    } catch (e) {
        console.error('Error adding product:', e);
        alert('Error: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Track';
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
// init(); // Removed auto-init to allow auth check first
