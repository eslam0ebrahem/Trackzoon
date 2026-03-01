// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — config.js
// Central state + configuration. Extended with persistence, event bus,
// multi-currency registry, and typed preference management.
// ─────────────────────────────────────────────────────────────────────────────

// ── CURRENCY REGISTRY ─────────────────────────────────────────────────────────
export const CURRENCIES = {
    EGP: { symbol: 'EGP', rate: 1,     locale: 'ar-EG', name: 'Egyptian Pound' },
    USD: { symbol: '$',   rate: 0.020,  locale: 'en-US', name: 'US Dollar'      },
    EUR: { symbol: '€',   rate: 0.019,  locale: 'de-DE', name: 'Euro'           },
    GBP: { symbol: '£',   rate: 0.016,  locale: 'en-GB', name: 'British Pound'  },
    SAR: { symbol: '﷼',   rate: 0.075,  locale: 'ar-SA', name: 'Saudi Riyal'    },
};

// ── APP CONSTANTS ─────────────────────────────────────────────────────────────
export const CONFIG = {
    VERSION:              '2.0.0',
    REFRESH_INTERVAL_MS:  30_000,    // 30s live data refresh
    SLOW_REFRESH_MS:      60_000,    // 1min secondary refresh
    DEALS_PER_PAGE:       20,
    SEARCH_DEBOUNCE_MS:   300,
    PREVIEW_DEBOUNCE_MS:  700,
    MAX_TICKER_ITEMS:     30,
    HISTORY_CACHE_TTL_MS: 120_000,  // 2min history cache
    API_RETRY_ATTEMPTS:   2,
    API_RETRY_DELAY_MS:   800,
    TOAST_DURATION_MS:    3500,
    SCORE_HOT_THRESHOLD:  70,
    SCORE_GOOD_THRESHOLD: 40,
    LOCAL_STORAGE_KEY:    'tz_v2',   // Namespaced storage key
};

// ── MUTABLE APPLICATION STATE ─────────────────────────────────────────────────
export const STATE = {
    // Auth
    token:            null,
    user:             null,
    isAdmin:          false,

    // Navigation
    currentPage:      'deals',
    previousPage:     null,

    // Deals
    allDeals:         [],
    filteredDeals:    [],
    dealsPage:        1,
    dealsTotalPages:  1,
    isLoadingDeals:   false,
    currentAsin:      null,
    currentDealData:  null,   // Full deal object for active card

    // Display
    currentView:      'grid',   // 'grid' | 'list'
    currentSort:      'smart',  // 'smart' | 'discount' | 'price_asc' | 'price_desc' | 'recent'
    currentFilter:    0,        // minDiscount value
    currentCurrency:  'EGP',

    // Search
    searchQuery:      '',

    // UI
    isSidebarCollapsed: false,
    cmdPaletteOpen:     false,
    cmdItems:           [],
    cmdSelectedIdx:     -1,
    gSequence:          '',

    // Analytics
    analyticsLoaded:    false,

    // Caches (in-memory)
    historyCache:    new Map(),  // asin → { data, timestamp }
    statsCache:      null,
    statsCacheTime:  0,
};

// ── PERSISTENT PREFERENCES ────────────────────────────────────────────────────
// Preferences that survive page reloads, stored in localStorage
const PREF_DEFAULTS = {
    theme:            'dark',
    currency:         'EGP',
    view:             'grid',
    sort:             'smart',
    filter:           0,
    sidebarCollapsed: false,
    ticker:           true,
    compact:          false,
    desktopNotifs:    false,
    sound:            false,
};

export const PREFS = {
    _data: { ...PREF_DEFAULTS },

    load() {
        try {
            const raw = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEY + '_prefs');
            if (raw) Object.assign(this._data, JSON.parse(raw));
        } catch { /* storage unavailable or corrupt — use defaults */ }
        return this;
    },

    save() {
        try {
            localStorage.setItem(CONFIG.LOCAL_STORAGE_KEY + '_prefs', JSON.stringify(this._data));
        } catch { /* ignore */ }
        return this;
    },

    get(key) { return this._data[key] ?? PREF_DEFAULTS[key]; },

    set(key, value) {
        this._data[key] = value;
        this.save();
        // Mirror relevant prefs into STATE
        if (key === 'currency') STATE.currentCurrency = value;
        if (key === 'view')     STATE.currentView      = value;
        if (key === 'sort')     STATE.currentSort      = value;
        if (key === 'filter')   STATE.currentFilter    = value;
        if (key === 'sidebarCollapsed') STATE.isSidebarCollapsed = value;
        return this;
    },

    toggle(key) { return this.set(key, !this._data[key]); },

    // Apply all prefs back into STATE after a fresh load
    applyToState() {
        STATE.currentCurrency    = this.get('currency');
        STATE.currentView        = this.get('view');
        STATE.currentSort        = this.get('sort');
        STATE.currentFilter      = this.get('filter');
        STATE.isSidebarCollapsed = this.get('sidebarCollapsed');
    },
};

// ── SIMPLE EVENT BUS ──────────────────────────────────────────────────────────
// Decouples modules: e.g. API layer emits 'deals:loaded', UI listens.
export const Bus = {
    _listeners: {},

    on(event, fn) {
        (this._listeners[event] ??= []).push(fn);
        return () => this.off(event, fn);  // Returns unsubscribe fn
    },

    off(event, fn) {
        this._listeners[event] = (this._listeners[event] || []).filter(f => f !== fn);
    },

    emit(event, payload) {
        (this._listeners[event] || []).forEach(fn => fn(payload));
    },
};
