// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — app.js
// Main application orchestrator.
// Upgrades over v1:
//  • No more alert() anywhere — replaced by toast notifications
//  • Proper auth flow: token login, guest mode, logout
//  • All data-fetching functions have try/catch + loading states
//  • Search with debounce and proper result rendering
//  • loadHistory fetches ALL analytics in one parallel batch (no sequential waterfalls)
//  • Auto-refresh: 30s for deals/ticker, 60s for stats/logs
//  • Keyboard shortcut system (Cmd+K palette, G+D nav, N, T, R, V, ?)
//  • Currency toggle re-renders all price displays without full reload
//  • Saved view (sort/filter/viewMode) persisted to PREFS
//  • Export functions for CSV, PDF, RSS (no alert on success)
//  • Admin actions with proper feedback
//  • Bus event system wires up chart updates decoupled from fetches
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG, STATE, PREFS, Bus }  from './config.js';
import { API }                         from './api.js';
import * as UI                         from './ui.js';
import {
    initAllCharts, updateTrendChart, updateCategoryChart,
    updateScoreChart, updateAlertChart, initPriceChart,
} from './charts.js';
import {
    debounce, throttle, shareDeal, copyToClipboard,
    formatPrice, formatAgo, $, animateNumber,
} from './utils.js';

// ── EXPOSE GLOBAL NAMESPACE ───────────────────────────────────────────────────
// HTML onclick= attributes call window.TZ.xxx
window.TZ = {
    loadHistory,
    handleCardClick,
    openCtxMenu,
    shareCard,
    navigate,
    openCmd,
    closeCmd,
    openQuickAdd,
    closeQuickAdd,
    openShortcuts,
    closeShortcuts,
    toggleTheme,
    toggleSidebar,
    openSidebar,
    closeSidebar,
    toggleNotifPanel,
    clearNotifs,
    openLogin,
    closeLogin,
    tokenLogin,
    continueAsGuest,
    telegramLogin,
    logout,
    toggleSetting,
    requestNotifPermission,
    setDealFilter,
    setSort,
    setFilter,
    fetchDeals,
    loadMoreDeals,
    toggleListView,
    ctxAction,
    submitQuickAdd,
    debouncedPreview,
    onModeChange,
    adminAction,
    handleExport,
    fetchLogs,
    toggleLogs,
    saveTags,
    saveTargetPrice,
    toggleArchive,
    openImportModal,
    closeImportModal,
    submitImport,
    saveCurrentView,
    generateApiKey,
    toggleCurrency,
};

// Also keep legacy window.* names for any inline handlers in index.html
Object.assign(window, window.TZ);
window.loadHistory     = loadHistory;   // Most referenced
window.shareDeal       = (name, url, price) => shareCard(null, { name, url, currentPrice: price });

// ── REFRESH INTERVALS ─────────────────────────────────────────────────────────
let _refreshTimer  = null;
let _slowTimer     = null;

// ── BOOT ──────────────────────────────────────────────────────────────────────
export async function init() {
    PREFS.load().applyToState();
    applyInitialPrefs();
    setupKeyboard();
    setupBusListeners();
    setupSearch();
    checkMobileNav();
    initAllCharts();

    await checkAuth();

    // Parallel initial data load
    await Promise.all([
        fetchDeals(),
        fetchRecent(),
        fetchTopTracked(),
        fetchCategoryStats(),
        fetchTopCategories(),
        fetchDealOpportunities(),
        fetchBestDrops(),
        fetchTrendOverview(),
        fetchStats(),
    ]);

    // Start auto-refresh
    _refreshTimer = setInterval(refreshFast, CONFIG.REFRESH_INTERVAL_MS);
    _slowTimer    = setInterval(refreshSlow, CONFIG.SLOW_REFRESH_MS);
}

document.addEventListener('DOMContentLoaded', init);

// ── AUTH ──────────────────────────────────────────────────────────────────────
async function checkAuth() {
    if (!API.hasToken()) {
        showLoginModal();
        return;
    }
    try {
        const d     = await API.getUserMe();
        STATE.user  = d.user;
        STATE.isAdmin = d.isAdmin;
        updateUserUI();
    } catch {
        API.clearToken();
        showLoginModal();
    }
}

function updateUserUI() {
    const u = STATE.user;
    const name = u ? (u.firstName || u.username || `User ${u.chatId || ''}`) : 'Guest';

    UI.applyTheme(PREFS.get('theme'));
    $('sidebarUserName') && ($('sidebarUserName').textContent = name);
    $('sidebarUserRole') && ($('sidebarUserRole').textContent = STATE.isAdmin ? 'Admin' : 'Shopper');
    $('avatarInitials')  && ($('avatarInitials').textContent  = name.charAt(0).toUpperCase());
    $('loginBtn')        && ($('loginBtn').textContent        = u ? '✓ Me' : '👤');

    if (STATE.isAdmin && $('adminNavSection')) {
        $('adminNavSection').style.display = '';
    }
    if (u && $('tab-my')) {
        $('tab-my')?.classList.remove('hidden');
    }
}

// ── APPLY INITIAL PREFS ───────────────────────────────────────────────────────
function applyInitialPrefs() {
    UI.applyTheme(PREFS.get('theme'));
    UI.updateCurrencyDisplay();

    const sidebarCollapsed = PREFS.get('sidebarCollapsed');
    if (sidebarCollapsed) {
        STATE.isSidebarCollapsed = true;
        $('sidebar')?.classList.add('collapsed');
        $('sidebarToggle') && ($('sidebarToggle').textContent = '▶');
    }

    if (!PREFS.get('ticker') && $('tickerBar')) {
        $('tickerBar').style.display = 'none';
    }

    // Sync settings toggles
    ['ticker','compact','desktopNotifs','sound'].forEach(key => {
        const el = $(key + 'Toggle');
        if (el) el.classList.toggle('on', PREFS.get(key));
    });
    $('darkModeToggle')?.classList.toggle('on', PREFS.get('theme') === 'dark');
}

// ── BUS LISTENERS ─────────────────────────────────────────────────────────────
function setupBusListeners() {
    Bus.on('toast', ({ msg, type }) => _showToast(msg, type));
    Bus.on('score:update', dist => updateScoreChart(dist));
}

// ── FAST REFRESH (every 30s) ──────────────────────────────────────────────────
async function refreshFast() {
    await Promise.all([
        fetchRecent().catch(() => {}),
        fetchBestDrops().catch(() => {}),
        fetchDealOpportunities().catch(() => {}),
    ]);
    if (STATE.currentPage <= 1) fetchDeals(1).catch(() => {});
}

// ── SLOW REFRESH (every 60s) ──────────────────────────────────────────────────
async function refreshSlow() {
    await Promise.all([
        fetchStats().catch(() => {}),
        fetchLogs().catch(() => {}),
        fetchTrendOverview().catch(() => {}),
    ]);
    if (STATE.isAdmin) fetchAdminStats().catch(() => {});
}

// ── STATS ─────────────────────────────────────────────────────────────────────
async function fetchStats() {
    try {
        const data = await API.getStats();
        UI.renderStats(data);
    } catch (e) { console.error('fetchStats', e); }
}

// ── DEALS ─────────────────────────────────────────────────────────────────────
async function fetchDeals(page = 1) {
    if (STATE.isLoadingDeals) return;
    STATE.isLoadingDeals = true;
    STATE.dealsPage = page;

    const container = $('dealsList');
    if (container && page === 1) {
        container.innerHTML = _skeletonCards(3);
    }

    try {
        const data = await API.getDeals({
            page,
            sort:        STATE.currentSort,
            minDiscount: STATE.currentFilter,
            chatId:      STATE.user?.chatId || '',
        });

        const deals = data.deals || data.data || [];

        if (page === 1) {
            STATE.allDeals      = deals;
            STATE.filteredDeals = deals;
        } else {
            STATE.allDeals      = [...STATE.allDeals, ...deals];
            STATE.filteredDeals = [...STATE.filteredDeals, ...deals];
        }

        STATE.dealsTotalPages = data.totalPages || 1;

        UI.renderDeals(STATE.filteredDeals, container, false);
        UI.updateTicker(STATE.allDeals);
        UI.renderScoreDistribution(STATE.allDeals);

        // Show/hide load-more button
        const lmBtn = $('loadMoreBtn');
        if (lmBtn) {
            lmBtn.style.display = (data.hasMore || page < STATE.dealsTotalPages) ? '' : 'none';
        }

        // Auto-load history for first deal on first page if none selected
        if (page === 1 && deals.length && !STATE.currentAsin) {
            const first = deals[0].product || deals[0];
            if (first.asin) loadHistory(first.asin);
        }
    } catch (e) {
        console.error('fetchDeals', e);
        if (container && page === 1) {
            container.innerHTML = `<div class="empty-state" style="grid-column:1/-1">
              <div class="icon">⚠️</div><h3>Failed to load deals</h3><p>${e.message}</p>
            </div>`;
        }
    } finally {
        STATE.isLoadingDeals = false;
    }
}

function setFilter(minDiscount) {
    STATE.currentFilter = minDiscount;
    STATE.dealsPage     = 1;
    PREFS.set('filter', minDiscount);

    document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
    $(`filter-${minDiscount}`)?.classList.add('active');

    fetchDeals(1);
}

function setSort(sortValue, label) {
    STATE.currentSort = sortValue;
    STATE.dealsPage   = 1;
    PREFS.set('sort', sortValue);

    setText('currentSortLabel', label || sortValue);
    $('sortDropdownMenu')?.classList.add('hidden');

    fetchDeals(1);
}
window.selectSort = setSort;

function setDealFilter(f, btn) { setFilter(f); }

function loadMoreDeals() {
    if (STATE.dealsPage < STATE.dealsTotalPages) {
        fetchDeals(STATE.dealsPage + 1);
    }
}

function toggleListView() {
    const next = STATE.currentView === 'grid' ? 'list' : 'grid';
    STATE.currentView = next;
    PREFS.set('view', next);

    const container = $('dealsList');
    if (container) container.classList.toggle('list-view', next === 'list');

    const btn = $('viewToggleBtn');
    if (btn) btn.textContent = next === 'list' ? '⊟' : '⊞';
}

function toggleView(view) {
    STATE.currentView = view;
    PREFS.set('view', view);
    const container = $('dealsList');
    if (container) container.classList.toggle('list-view', view === 'list');
}

// ── PRODUCT HISTORY ───────────────────────────────────────────────────────────
async function loadHistory(asin, titleEnc) {
    if (!asin) return;
    try {
        const title = titleEnc ? decodeURIComponent(titleEnc) : asin;

        // Show loading state in panel
        const panel = $('historyPanel');
        if (panel) {
            panel.classList.add('visible');
            const titleEl = $('chartTitle');
            if (titleEl) titleEl.textContent = title;
            const statsEl = $('historyStats');
            if (statsEl) statsEl.innerHTML = '<div style="color:var(--text3);font-size:13px">Loading analytics…</div>';
        }

        // Check cache
        const cached = STATE.historyCache.get(asin);
        if (cached && Date.now() - cached.timestamp < CONFIG.HISTORY_CACHE_TTL_MS) {
            UI.showProductHistory(cached.data.history, asin, cached.data.analytics);
            return;
        }

        // Fetch all analytics in parallel
        const analytics = await API.getAllProductAnalytics(asin);

        // Store in cache
        STATE.historyCache.set(asin, {
            data:      { history: analytics.history || { name: title, currentPrice: 0, priceHistory: [] }, analytics },
            timestamp: Date.now(),
        });

        UI.showProductHistory(
            analytics.history || { name: title, currentPrice: 0, priceHistory: [] },
            asin,
            analytics,
        );
    } catch (e) {
        console.error('loadHistory', e);
        _showToast('Failed to load history: ' + e.message, 'error');
    }
}

function handleCardClick(event, asin, titleEnc) {
    // Don't open history if clicking a button or link inside the card
    if (event.target.closest('button, a')) return;
    loadHistory(asin, titleEnc);
}

function closeHistory() {
    $('historyPanel')?.classList.remove('visible');
}
window.closeHistory = closeHistory;

// ── TAGS & TARGET ─────────────────────────────────────────────────────────────
async function saveTags() {
    const tags = $('productTags')?.value.split(',').map(t => t.trim()).filter(Boolean);
    if (!tags) return;
    try {
        await API.updateTags(STATE.currentAsin, tags);
        _showToast('Tags saved!', 'success');
    } catch (e) { _showToast('Error saving tags: ' + e.message, 'error'); }
}

async function saveTargetPrice() {
    const price = parseFloat($('productTargetPrice')?.value);
    if (isNaN(price)) return _showToast('Invalid price', 'warn');
    try {
        await API.updateTargetPrice(STATE.currentAsin, price);
        _showToast('Target price updated!', 'success');
    } catch (e) { _showToast('Error: ' + e.message, 'error'); }
}

async function toggleArchive() {
    const asin = STATE.currentAsin;
    if (!asin) return;
    try {
        const data = await API.archiveProduct(asin);
        _showToast(data.archived ? 'Product archived' : 'Product unarchived', 'success');
        fetchDeals(1);
    } catch (e) { _showToast('Error: ' + e.message, 'error'); }
}

// ── RECENT / TOP TRACKED ──────────────────────────────────────────────────────
async function fetchRecent() {
    try {
        const data = await API.getRecent();
        UI.renderRecent(data);
        UI.updateTicker(data);
    } catch (e) { console.error('fetchRecent', e); }
}

async function fetchTopTracked() {
    try {
        const data = await API.getTopTracked();
        UI.renderTopTracked(data);
    } catch (e) { console.error('fetchTopTracked', e); }
}

async function fetchDealOpportunities() {
    try {
        const data = await API.getDealOpportunities();
        UI.renderDealOpportunities(data?.items || data || []);
    } catch (e) { console.error('fetchDealOpportunities', e); }
}

async function fetchBestDrops() {
    try {
        const data = await API.getBestDrops();
        UI.renderBestDrops(data?.items || data || []);
    } catch (e) { console.error('fetchBestDrops', e); }
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
async function fetchCategoryStats() {
    try {
        const data = await API.getCategoryStats();
        updateCategoryChart(data.labels || [], data.data || []);
    } catch (e) { console.error('fetchCategoryStats', e); }
}

async function fetchTopCategories() {
    try {
        const data = await API.getTopCategories();
        UI.renderTopCategories(data?.categories || data || []);
    } catch (e) { console.error('fetchTopCategories', e); }
}

async function fetchTrendOverview() {
    try {
        const data = await API.getTrendOverview();
        updateTrendChart(data);

        // Forecast widget in the sidebar
        const trend  = String(data?.trend || '').toUpperCase();
        const isDown = trend === 'DOWN' || trend === 'DROP';
        const isUp   = trend === 'UP'   || trend === 'RISE';
        const trendEl = $('forecastTrend');
        if (trendEl) {
            trendEl.textContent = isDown ? '📉 Falling' : isUp ? '📈 Rising' : '➡️ Stable';
            trendEl.style.color = isDown ? 'var(--green)' : isUp ? 'var(--red)' : 'var(--text2)';
        }
        const confEl = $('forecastConfidence');
        if (confEl && data?.confidence != null) {
            confEl.textContent = `Confidence: ${(data.confidence * 100).toFixed(0)}%`;
        }
    } catch (e) { console.error('fetchTrendOverview', e); }
}

// ── SEARCH ────────────────────────────────────────────────────────────────────
function setupSearch() {
    const input   = $('searchInput');
    const results = $('searchResults');
    if (!input || !results) return;

    input.addEventListener('input', debounce(async e => {
        const q = e.target.value.trim();
        if (q.length < 2) { results.classList.add('hidden'); return; }
        try {
            const data = await API.search(q);
            UI.renderSearchResults(data, results);
        } catch { results.classList.add('hidden'); }
    }, CONFIG.SEARCH_DEBOUNCE_MS));

    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !results.contains(e.target)) {
            results.classList.add('hidden');
        }
    });
}

// ── LOGS ──────────────────────────────────────────────────────────────────────
async function fetchLogs() {
    try {
        const level  = $('logLevelFilter')?.value  || 'all';
        const search = $('logSearch')?.value       || '';
        const data   = await API.getLogs({ level, search, limit: 400 });
        UI.renderLogs(data);
    } catch (e) {
        const el = $('logsList');
        if (el) el.innerHTML = `<div style="color:var(--red);font-size:12px">Failed to load logs: ${e.message}</div>`;
    }
}

function toggleLogs() {
    const visible = UI.toggleLogs();
    if (visible) fetchLogs();
}

// ── HEALTH ────────────────────────────────────────────────────────────────────
async function fetchHealth() {
    try {
        const data = await API.getHealth();
        UI.updateHealth(data);
    } catch { UI.updateHealthError(); }
}

// ── ADMIN ─────────────────────────────────────────────────────────────────────
async function fetchAdminStats() {
    if (!STATE.isAdmin) return;
    try {
        const [health, dbStats, extStats] = await Promise.allSettled([
            API.getHealth(),
            API.getDbStats(),
            API.getExtensionStats(),
        ]);
        UI.renderAdminStats(
            health.status   === 'fulfilled' ? health.value   : null,
            dbStats.status  === 'fulfilled' ? dbStats.value  : null,
            extStats.status === 'fulfilled' ? extStats.value : null,
        );
    } catch (e) { console.error('fetchAdminStats', e); }
}

async function adminAction(action) {
    try {
        if (action === 'health') {
            await fetchAdminStats();
            _showToast('Health data refreshed', 'success');
        } else if (action === 'check-prices') {
            await API.triggerPriceCheck();
            _showToast('Price check triggered ⚡', 'success');
        } else if (action === 'scrape-all') {
            await API.triggerScrapeAll();
            _showToast('Scrape job queued 🕷️', 'success');
        } else if (action === 'broadcast') {
            const msg = window.prompt('Enter broadcast message for all users:');
            if (!msg) return;
            const res = await API.broadcastMessage(msg);
            _showToast(`Broadcast sent to ${res.sent || '?'} users`, 'success');
        }
    } catch (e) { _showToast('Action failed: ' + e.message, 'error'); }
}

// ── QUICK ADD ─────────────────────────────────────────────────────────────────
let _previewTimer;

function openQuickAdd() { UI.openAddProductModal(); }
function closeQuickAdd() { UI.closeAddProductModal(); }

function onModeChange() {
    const mode = $('qaMode')?.value;
    const lbl  = $('qaThreshLabel');
    const inp  = $('qaThreshold');
    if (!lbl || !inp) return;
    if (mode === 'price')   { lbl.textContent = 'Target Price'; inp.placeholder = '0.00'; inp.style.display = ''; }
    else if (mode === 'percent') { lbl.textContent = '% Drop'; inp.placeholder = '10'; inp.style.display = ''; }
    else { lbl.textContent = 'N/A'; inp.style.display = 'none'; }
}

function debouncedPreview() {
    clearTimeout(_previewTimer);
    _previewTimer = setTimeout(doPreview, CONFIG.PREVIEW_DEBOUNCE_MS);
}

async function doPreview() {
    const url = $('qaUrl')?.value.trim();
    if (!url || url.length < 10) return;

    const box = $('previewBox');
    if (!box) return;
    box.innerHTML = '<div class="preview-loading">🔍 Fetching product details…</div>';
    box.classList.add('visible');

    try {
        const d  = await API.previewProduct(url);
        const p  = d.product || d;
        box.innerHTML = `
          <div style="display:flex;gap:12px;align-items:center">
            ${p.imageUrl
                ? `<img src="${p.imageUrl}" style="width:52px;height:52px;border-radius:7px;object-fit:cover">`
                : '<div style="width:52px;height:52px;border-radius:7px;background:var(--bg3);display:flex;align-items:center;justify-content:center;font-size:22px">📦</div>'}
            <div>
              <div style="font-size:13px;font-weight:600;margin-bottom:4px;line-height:1.3">
                ${(p.title || 'Product').substring(0, 72)}${(p.title || '').length > 72 ? '…' : ''}
              </div>
              <div style="font-family:var(--font-mono);font-size:16px;color:var(--amber)">
                ${p.currentPrice ? formatPrice(p.currentPrice) : 'Price unavailable'}
              </div>
              ${p.asin ? `<div style="font-size:10px;color:var(--text3);font-family:var(--font-mono);margin-top:3px">ASIN: ${p.asin}</div>` : ''}
            </div>
          </div>`;

        // Auto-fill ASIN hint
        if (p.currentPrice) {
            const inp = $('qaThreshold');
            if (inp && !inp.value) inp.placeholder = (p.currentPrice * 0.9).toFixed(2);
        }
    } catch (e) {
        box.innerHTML = `<div style="color:var(--red);font-size:13px">⚠️ ${e.message}</div>`;
    }
}

async function submitQuickAdd() {
    const url       = $('qaUrl')?.value.trim();
    if (!url) return _showToast('Please enter a product URL or ASIN', 'warn');

    const mode      = $('qaMode')?.value       || 'price';
    const threshold = parseFloat($('qaThreshold')?.value) || 0;
    const chatId    = $('qaChatId')?.value.trim() || STATE.user?.chatId;

    try {
        await API.addProduct({ url, threshold, mode, chatId });
        _showToast('Product added to tracking! 🎉', 'success');
        closeQuickAdd();
        STATE.dealsPage = 1;
        fetchDeals(1);
        fetchStats();
    } catch (e) {
        _showToast('Error: ' + e.message, 'error');
    }
}

// ── IMPORT ────────────────────────────────────────────────────────────────────
function openImportModal()  { $('importModal')?.classList.remove('hidden'); }
function closeImportModal() { $('importModal')?.classList.add('hidden'); }

async function submitImport() {
    const input = $('importUrls');
    if (!input) return _showToast('Import input not found', 'error');

    const urls = input.value.split('\n').map(u => u.trim()).filter(Boolean);
    if (!urls.length) return _showToast('Enter at least one URL', 'warn');

    const btn = document.querySelector('#importModal button:last-child');
    if (btn) { btn.textContent = 'Importing…'; btn.disabled = true; }

    try {
        const res = await API.bulkImport(urls);
        _showToast(`Imported: ${res.success || 0} · Failed: ${res.failed || 0}`, 'success');
        closeImportModal();
        input.value = '';
        fetchDeals(1);
    } catch (e) {
        _showToast('Import error: ' + e.message, 'error');
    } finally {
        if (btn) { btn.textContent = 'Import'; btn.disabled = false; }
    }
}

// ── EXPORT ────────────────────────────────────────────────────────────────────
async function handleExport(type) {
    try {
        if (type === 'csv') {
            await API.downloadCSV();
            _showToast('CSV download started 📄', 'success');
        } else if (type === 'pdf') {
            API.openPDFReport();
            _showToast('PDF opening in new tab 📑', 'success');
        } else if (type === 'rss') {
            const url = API.getRSSUrl();
            await copyToClipboard(url);
            _showToast('RSS URL copied to clipboard! 📡', 'success');
        }
    } catch (e) { _showToast('Export failed: ' + e.message, 'error'); }
}

// ── CURRENCY ──────────────────────────────────────────────────────────────────
function toggleCurrency() {
    const currencies = ['EGP', 'USD', 'EUR'];
    const idx = currencies.indexOf(STATE.currentCurrency);
    const next = currencies[(idx + 1) % currencies.length];
    STATE.currentCurrency = next;
    PREFS.set('currency', next);
    UI.updateCurrencyDisplay();
    // Re-render deals with new currency
    UI.renderDeals(STATE.filteredDeals, $('dealsList'), false);
    if (STATE.currentAsin) loadHistory(STATE.currentAsin);
}

// ── CONTEXT MENU ──────────────────────────────────────────────────────────────
let _ctxAsin = null;

function openCtxMenu(e, asin) {
    e.preventDefault();
    e.stopPropagation();
    _ctxAsin = asin;
    const m = $('contextMenu');
    if (!m) return;
    m.style.display = 'block';
    m.style.left    = Math.min(e.clientX, window.innerWidth  - 200) + 'px';
    m.style.top     = Math.min(e.clientY, window.innerHeight - 200) + 'px';
}

document.addEventListener('click', () => {
    const m = $('contextMenu');
    if (m) m.style.display = 'none';
});

async function ctxAction(action) {
    const asin = _ctxAsin;
    if (!asin) return;
    const deal = STATE.allDeals.find(d => (d.product || d).asin === asin);
    const p    = deal ? (deal.product || deal) : {};

    switch (action) {
        case 'history':
            loadHistory(asin, encodeURIComponent(p.title || p.name || asin));
            break;
        case 'copy':
            await copyToClipboard(`https://www.amazon.com/dp/${asin}`);
            _showToast('Link copied!', 'success');
            break;
        case 'share':
            shareCard(asin);
            break;
        case 'setTarget': {
            const val = window.prompt(`Set target price for:\n${p.title || asin}`);
            if (val && !isNaN(parseFloat(val))) {
                try {
                    await API.updateTargetPrice(asin, parseFloat(val));
                    _showToast('Target price set!', 'success');
                } catch (e) { _showToast('Error: ' + e.message, 'error'); }
            }
            break;
        }
        case 'untrack':
            if (window.confirm(`Stop tracking "${p.title || asin}"?`)) {
                try {
                    await API.deleteProduct(asin);
                    _showToast('Product removed from tracking', 'success');
                    fetchDeals(1);
                } catch (e) { _showToast('Error: ' + e.message, 'error'); }
            }
            break;
    }

    $('contextMenu') && ($('contextMenu').style.display = 'none');
}

function shareCard(asin) {
    const deal = STATE.allDeals.find(d => (d.product || d).asin === asin);
    const p    = deal ? (deal.product || deal) : { asin };
    shareDeal(p, copied => {
        if (copied) _showToast('Deal link copied!', 'success');
    });
}

// ── NAVIGATION ────────────────────────────────────────────────────────────────
const PAGE_TITLES = {
    deals: 'Live Deals', watchlist: 'My Watchlist', analytics: 'Analytics',
    alerts: 'Alert Rules', exports: 'Export', admin: 'System Admin', settings: 'Settings',
};

function navigate(page) {
    STATE.previousPage = STATE.currentPage;
    STATE.currentPage  = page;

    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    $(`page-${page}`)?.classList.add('active');

    document.querySelectorAll('.nav-item[data-page]').forEach(n => {
        n.classList.toggle('active', n.dataset.page === page);
    });
    document.querySelectorAll('.mob-nav-item[id]').forEach(n => {
        n.classList.toggle('active', n.id === `mob-${page}`);
    });

    const titleEl = $('topbarTitle');
    if (titleEl) titleEl.textContent = PAGE_TITLES[page] || page;

    if (page === 'analytics' && !STATE.analyticsLoaded) {
        STATE.analyticsLoaded = true;
        fetchCategoryStats();
        fetchTrendOverview();
    }
    if (page === 'watchlist' && STATE.user) {
        loadWatchlist();
    }
    if (page === 'admin' && STATE.isAdmin) {
        fetchAdminStats();
    }
    closeSidebar();
}

async function loadWatchlist() {
    const c = $('watchlistContent');
    if (!c) return;
    c.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text2)">Loading…</div>';
    try {
        const data  = await API.getUserProducts();
        const items = Array.isArray(data) ? data : (data.products || []);
        if (!items.length) {
            c.innerHTML = '<div class="empty-state"><div class="icon">📦</div><h3>Nothing tracked yet</h3><p>Add your first product to get started</p></div>';
            return;
        }
        c.innerHTML = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:16px">
          ${items.map(UI.renderWatchlistCard ? UI.renderWatchlistCard : renderWatchlistCard).join('')}
        </div>`;
    } catch (e) {
        c.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Error</h3><p>${e.message}</p></div>`;
    }
}

function renderWatchlistCard(p) {
    return `<div class="deal-card">
      <div class="deal-card-header">
        <div class="deal-img">${p.imageUrl ? `<img src="${p.imageUrl}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='📦'">` : '📦'}</div>
        <div class="deal-info">
          <div class="deal-title">${p.title || p.name || p.asin}</div>
          <div class="deal-badges">
            <span class="badge" style="background:var(--bg3);color:var(--text3);border:1px solid var(--border)">${p.asin}</span>
          </div>
        </div>
      </div>
      <div class="deal-card-footer">
        <button class="deal-action" onclick="window.TZ.loadHistory('${p.asin}','${encodeURIComponent(p.title||p.asin)}')">📈 History</button>
        ${p.asin ? `<a class="deal-action primary" href="https://www.amazon.com/dp/${p.asin}" target="_blank">View ↗</a>` : ''}
      </div>
    </div>`;
}

// ── SIDEBAR ───────────────────────────────────────────────────────────────────
function toggleSidebar() {
    STATE.isSidebarCollapsed = !STATE.isSidebarCollapsed;
    PREFS.set('sidebarCollapsed', STATE.isSidebarCollapsed);
    $('sidebar')?.classList.toggle('collapsed', STATE.isSidebarCollapsed);
    const btn = $('sidebarToggle');
    if (btn) btn.textContent = STATE.isSidebarCollapsed ? '▶' : '◀';
}

function openSidebar() {
    $('sidebar')?.classList.add('open');
    $('sidebarOverlay')?.classList.add('visible');
}

function closeSidebar() {
    $('sidebar')?.classList.remove('open');
    $('sidebarOverlay')?.classList.remove('visible');
}

function checkMobileNav() {
    const mq = window.matchMedia('(max-width: 1024px)');
    const update = () => {
        const btn = $('mobileMenuBtn');
        if (btn) btn.style.display = mq.matches ? 'flex' : 'none';
    };
    mq.addEventListener('change', update);
    update();
}

// ── THEME ─────────────────────────────────────────────────────────────────────
function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const next   = isDark ? 'light' : 'dark';
    PREFS.set('theme', next);
    UI.applyTheme(next);
}

function toggleSetting(key) {
    PREFS.toggle(key);
    const el = $(key + 'Toggle');
    if (el) el.classList.toggle('on', PREFS.get(key));
    if (key === 'ticker') {
        const ticker = $('tickerBar');
        if (ticker) ticker.style.display = PREFS.get('ticker') ? '' : 'none';
    }
    if (key === 'compact') {
        $('dealsList')?.classList.toggle('compact', PREFS.get('compact'));
    }
}

function requestNotifPermission() {
    if (!('Notification' in window)) return _showToast('Notifications not supported', 'warn');
    Notification.requestPermission().then(p => {
        const granted = p === 'granted';
        PREFS.set('desktopNotifs', granted);
        $('desktopNotifToggle')?.classList.toggle('on', granted);
        _showToast(granted ? 'Notifications enabled!' : 'Permission denied', granted ? 'success' : 'warn');
    });
}

// ── NOTIFICATIONS PANEL ───────────────────────────────────────────────────────
function toggleNotifPanel() {
    $('notifPanel')?.classList.toggle('open');
}

function clearNotifs() {
    const list = $('notifList');
    if (list) list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">All caught up! 🎉</div>';
    $('notifCount') && ($('notifCount').style.display = 'none');
    $('notifPanel')?.classList.remove('open');
}

// ── LOGIN ─────────────────────────────────────────────────────────────────────
function showLoginModal() { $('loginModal')?.classList.add('open'); }
function openLogin()      { showLoginModal(); }
function closeLogin()     { $('loginModal')?.classList.remove('open'); }

function continueAsGuest() {
    closeLogin();
    _showToast('Browsing as guest — some features require login', 'info');
}

function telegramLogin() {
    _showToast('Use /dashboard in your Telegram bot to get a login link', 'info');
}

async function tokenLogin() {
    const token = $('tokenInput')?.value.trim();
    if (!token) return _showToast('Please enter a token', 'warn');
    try {
        const d = await API.loginWithToken(token);
        STATE.user    = d.user;
        STATE.isAdmin = d.isAdmin;
        updateUserUI();
        closeLogin();
        _showToast('Logged in successfully!', 'success');
        fetchStats();
        fetchDeals(1);
        if (STATE.isAdmin) fetchAdminStats();
    } catch (e) {
        _showToast('Invalid token: ' + e.message, 'error');
    }
}

async function logout() {
    API.logout();
    STATE.user    = null;
    STATE.isAdmin = false;
    updateUserUI();
    $('adminNavSection') && ($('adminNavSection').style.display = 'none');
    $('tab-my')?.classList.add('hidden');
    _showToast('Logged out', 'info');
    showLoginModal();
}

// ── GENERATE API KEY ──────────────────────────────────────────────────────────
async function generateApiKey() {
    if (!window.confirm('Generate new API Key? This will invalidate the old one.')) return;
    try {
        const res = await API.generateApiKey();
        const el  = $('apiKey');
        if (el) el.value = res.apiKey;
        _showToast('New API key generated!', 'success');
    } catch (e) { _showToast('Error: ' + e.message, 'error'); }
}

// ── SAVE / LOAD VIEW ──────────────────────────────────────────────────────────
function saveCurrentView() {
    PREFS.set('sort',   STATE.currentSort);
    PREFS.set('filter', STATE.currentFilter);
    PREFS.set('view',   STATE.currentView);
    _showToast('View settings saved!', 'success');
}

// loadSavedView is now handled by PREFS.applyToState() in init()
function loadSavedView() { PREFS.load().applyToState(); }
window.loadSavedView = loadSavedView;

// ── COMMAND PALETTE ───────────────────────────────────────────────────────────
const CMD_ACTIONS = [
    { icon: '🔥', label: 'Live Deals',          sub: 'G D',  action: () => navigate('deals')     },
    { icon: '📦', label: 'My Watchlist',         sub: '',     action: () => navigate('watchlist')  },
    { icon: '📊', label: 'Analytics',            sub: 'G A',  action: () => navigate('analytics')  },
    { icon: '🔔', label: 'Alert Rules',          sub: '',     action: () => navigate('alerts')     },
    { icon: '📤', label: 'Export CSV',           sub: '',     action: () => handleExport('csv')    },
    { icon: '📑', label: 'Export PDF',           sub: '',     action: () => handleExport('pdf')    },
    { icon: '📡', label: 'Copy RSS Feed URL',    sub: '',     action: () => handleExport('rss')    },
    { icon: '⚡', label: 'Track New Product',    sub: 'N',    action: openQuickAdd                 },
    { icon: '🔄', label: 'Refresh Deals',        sub: 'R',    action: () => { STATE.dealsPage=1; fetchDeals(1); } },
    { icon: '🌙', label: 'Toggle Dark Mode',     sub: 'T',    action: toggleTheme                  },
    { icon: '⊞',  label: 'Toggle Grid/List',     sub: 'V',    action: toggleListView               },
    { icon: '💱', label: 'Toggle Currency',      sub: 'C',    action: toggleCurrency               },
    { icon: '⌨️', label: 'Keyboard Shortcuts',   sub: '?',    action: openShortcuts                },
    { icon: '⚙️', label: 'Settings',             sub: '',     action: () => navigate('settings')   },
    { icon: '🚪', label: 'Logout',               sub: '',     action: logout                       },
];

function openCmd() {
    STATE.cmdPaletteOpen = true;
    STATE.cmdItems       = CMD_ACTIONS;
    STATE.cmdSelectedIdx = 0;
    $('cmdOverlay')?.classList.add('open');
    const inp = $('cmdInput');
    if (inp) { inp.value = ''; setTimeout(() => inp.focus(), 30); }
    renderCmdResults(CMD_ACTIONS);
}

function closeCmd() {
    STATE.cmdPaletteOpen = false;
    $('cmdOverlay')?.classList.remove('open');
}

function filterCmd(q) {
    const lower = (q || '').toLowerCase();
    const items = lower ? CMD_ACTIONS.filter(a => a.label.toLowerCase().includes(lower)) : CMD_ACTIONS;
    STATE.cmdItems       = items;
    STATE.cmdSelectedIdx = items.length ? 0 : -1;
    renderCmdResults(items);
}
window.filterCmd = filterCmd;

function renderCmdResults(items) {
    const el = $('cmdResults');
    if (!el) return;
    el.innerHTML = items.map((a, i) => `
      <div class="cmd-result-item ${i === STATE.cmdSelectedIdx ? 'selected' : ''}"
           onclick="window.TZ.runCmdItem(${i})">
        <span class="cmd-result-icon">${a.icon}</span>
        <span>${a.label}</span>
        ${a.sub ? `<span class="cmd-result-sub">${a.sub}</span>` : ''}
      </div>`).join('') || '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">No matches</div>';
}

function runCmdItem(i) {
    const item = STATE.cmdItems[i];
    if (item) { item.action(); closeCmd(); }
}
window.TZ.runCmdItem = runCmdItem;

function cmdKey(e) {
    const items = STATE.cmdItems || CMD_ACTIONS;
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        STATE.cmdSelectedIdx = (STATE.cmdSelectedIdx + 1) % items.length;
        renderCmdResults(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        STATE.cmdSelectedIdx = (STATE.cmdSelectedIdx - 1 + items.length) % items.length;
        renderCmdResults(items);
    } else if (e.key === 'Enter' && STATE.cmdSelectedIdx >= 0) {
        runCmdItem(STATE.cmdSelectedIdx);
    } else if (e.key === 'Escape') {
        closeCmd();
    }
}
window.cmdKey = cmdKey;

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────────────────────
function openShortcuts()  { $('shortcutsOverlay')?.classList.add('open'); }
function closeShortcuts() { $('shortcutsOverlay')?.classList.remove('open'); }

function setupKeyboard() {
    document.addEventListener('keydown', e => {
        const tag    = document.activeElement.tagName;
        const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

        // Always-on: Cmd/Ctrl+K
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            openCmd();
            return;
        }

        // / to focus search (unless typing)
        if (e.key === '/' && !typing) {
            e.preventDefault();
            $('searchInput')?.focus();
            return;
        }

        // If command palette is open, delegate to its handler
        if (STATE.cmdPaletteOpen) return;

        if (typing) return;

        switch (e.key) {
            case '?':         openShortcuts();  break;
            case 'Escape':    closeCmd(); closeShortcuts(); closeQuickAdd(); closeHistory(); break;
            case 'n': case 'N': openQuickAdd(); break;
            case 't': case 'T': toggleTheme();  break;
            case 'v': case 'V': toggleListView(); break;
            case 'c': case 'C': toggleCurrency(); break;
            case 'r': case 'R':
                STATE.dealsPage = 1;
                fetchDeals(1);
                _showToast('Deals refreshed', 'info');
                break;
            case 'g': case 'G':
                STATE.gSequence = 'g';
                setTimeout(() => { STATE.gSequence = ''; }, 1000);
                break;
            default:
                if (STATE.gSequence === 'g') {
                    if (e.key === 'd') navigate('deals');
                    else if (e.key === 'a') navigate('analytics');
                    else if (e.key === 'w') navigate('watchlist');
                    else if (e.key === 's') navigate('settings');
                    STATE.gSequence = '';
                }
        }
    });
}

// ── SORT DROPDOWN ─────────────────────────────────────────────────────────────
window.toggleSortDropdown = () => {
    const menu = $('sortDropdownMenu');
    if (!menu) return;
    menu.classList.toggle('hidden');
    if (!menu.classList.contains('hidden')) {
        const close = e => {
            if (!e.target.closest('#sortDropdownMenu') && !e.target.closest('#sortButton')) {
                menu.classList.add('hidden');
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 0);
    }
};

// ── SAVE USER SETTINGS ────────────────────────────────────────────────────────
window.saveUserSettings = async () => {
    const settings = {
        notifications: $('notificationsToggle')?.checked ?? true,
        quietMode:     $('quietModeToggle')?.checked     ?? false,
        minDiscount:   parseFloat($('minDiscountInput')?.value) || 0,
        sensitivity:   $('sensitivitySelect')?.value || 'medium',
    };
    try {
        await API.saveUserSettings(settings);
        _showToast('Settings saved!', 'success');
        $('settingsModal')?.classList.add('hidden');
    } catch (e) { _showToast('Error saving settings: ' + e.message, 'error'); }
};

// ── TOAST ─────────────────────────────────────────────────────────────────────
function _showToast(msg, type = 'info') {
    const container = $('toastContainer');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
    const t     = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span class="toast-icon">${icons[type] || 'ℹ️'}</span><span class="toast-msg">${msg}</span>`;
    container.prepend(t);

    setTimeout(() => {
        t.classList.add('hide');
        setTimeout(() => t.remove(), 350);
    }, CONFIG.TOAST_DURATION_MS);
}

// ── SKELETON CARDS ────────────────────────────────────────────────────────────
function _skeletonCards(n = 3) {
    const card = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden">
      <div style="padding:16px;display:flex;gap:14px;border-bottom:1px solid var(--border)">
        <div class="skeleton" style="width:64px;height:64px;border-radius:8px;flex-shrink:0"></div>
        <div style="flex:1">
          <div class="skeleton" style="height:13px;margin-bottom:8px;border-radius:4px"></div>
          <div class="skeleton" style="height:13px;width:60%;border-radius:4px"></div>
        </div>
      </div>
      <div style="padding:14px 16px">
        <div class="skeleton" style="height:22px;width:40%;margin-bottom:12px;border-radius:4px"></div>
        <div class="skeleton" style="height:36px;border-radius:6px"></div>
      </div>
    </div>`;
    return Array(n).fill(card).join('');
}

// ── setText (local helper for legacy inline references) ───────────────────────
function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}
