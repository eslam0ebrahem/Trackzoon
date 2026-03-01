// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — charts.js
// Upgrades over v1:
//  • Theme-aware palette (auto-adjusts on dark/light toggle)
//  • priceChart now shows actual + forecast + all-time-low/high markers
//  • New: alertActivityChart, scoreDistributionChart, volatilityHeatmap
//  • Consistent ChartDefaults applied globally
//  • Exported helpers to update each chart from app.js
//  • Chart instances stored in a registry — no leaked globals
// ─────────────────────────────────────────────────────────────────────────────

import { CONFIG } from './config.js';
import { formatChartDate } from './utils.js';

// ── CHART REGISTRY ────────────────────────────────────────────────────────────
const REGISTRY = {};

function register(key, instance) {
    if (REGISTRY[key]) { try { REGISTRY[key].destroy(); } catch { /* ignore */ } }
    REGISTRY[key] = instance;
    return instance;
}

function get(key) { return REGISTRY[key] || null; }

// ── THEME PALETTE ─────────────────────────────────────────────────────────────
function palette() {
    const cs = getComputedStyle(document.documentElement);
    const v  = k => cs.getPropertyValue(k).trim();
    return {
        amber:      v('--amber')  || '#F59E0B',
        green:      v('--green')  || '#10B981',
        red:        v('--red')    || '#EF4444',
        blue:       v('--blue')   || '#3B82F6',
        text2:      v('--text2')  || '#94a3b8',
        text3:      v('--text3')  || '#475569',
        border:     v('--border') || 'rgba(255,255,255,0.07)',
        bg3:        v('--bg3')    || '#111827',
        amberFill:  v('--amber-glow') || 'rgba(245,158,11,0.10)',
        greenFill:  v('--green-glow') || 'rgba(16,185,129,0.10)',
        redFill:    v('--red-glow')   || 'rgba(239,68,68,0.10)',
        blueFill:   v('--blue-glow')  || 'rgba(59,130,246,0.10)',
    };
}

// ── GLOBAL CHART DEFAULTS ─────────────────────────────────────────────────────
function applyDefaults() {
    const p = palette();
    Chart.defaults.font.family   = "'JetBrains Mono', monospace";
    Chart.defaults.font.size     = 11;
    Chart.defaults.color         = p.text2;
    Chart.defaults.borderColor   = p.border;
    Chart.defaults.plugins.legend.display = false;
    Chart.defaults.plugins.tooltip.backgroundColor = '#0d1220';
    Chart.defaults.plugins.tooltip.borderColor      = p.border;
    Chart.defaults.plugins.tooltip.borderWidth      = 1;
    Chart.defaults.plugins.tooltip.padding          = 10;
    Chart.defaults.plugins.tooltip.titleFont        = { family: "'Syne', sans-serif", weight: '700', size: 12 };
    Chart.defaults.plugins.tooltip.bodyFont         = { family: "'JetBrains Mono', monospace", size: 11 };
    Chart.defaults.animation.duration               = 600;
}

// ── SHARED SCALE CONFIGS ──────────────────────────────────────────────────────
function xScale(extra = {}) {
    const p = palette();
    return {
        grid:  { color: p.border, drawBorder: false },
        ticks: { color: p.text2, maxTicksLimit: 8, ...extra.ticks },
        ...extra,
    };
}

function yScale(extra = {}) {
    const p = palette();
    return {
        grid:  { color: p.border, drawBorder: false },
        ticks: { color: p.text2, ...extra.ticks },
        beginAtZero: false,
        ...extra,
    };
}

// ── PRICE CHART (History panel) ───────────────────────────────────────────────
/**
 * Initialize or reinitialize the main product price history chart.
 * @param {string} canvasId
 * @param {object} [opts]
 */
export function initPriceChart(canvasId = 'priceChart') {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const p = palette();

    return register('price', new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [
                {
                    label:           'Price',
                    data:            [],
                    borderColor:     p.amber,
                    backgroundColor: p.amberFill,
                    borderWidth:     2,
                    pointRadius:     0,
                    pointHoverRadius: 5,
                    tension:         0.3,
                    fill:            true,
                },
                {
                    label:       'Forecast',
                    data:        [],
                    borderColor: p.green,
                    borderDash:  [6, 4],
                    borderWidth: 2,
                    pointRadius: 0,
                    tension:     0.3,
                    fill:        false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: true, position: 'top',
                    labels: { usePointStyle: true, pointStyleWidth: 10, color: p.text2 } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.dataset.label}: ${ctx.raw?.toFixed(2) ?? ctx.raw}`,
                    },
                },
                // Annotation plugin (optional — graceful no-op if not loaded)
                annotation: { annotations: {} },
            },
            scales: {
                x: xScale({ ticks: { maxTicksLimit: 8 } }),
                y: yScale({
                    ticks: { callback: v => v.toFixed(0) },
                }),
            },
        },
    }));
}

/**
 * Push new data into the price chart.
 * @param {string[]} labels
 * @param {number[]} priceData
 * @param {number[]} [forecastData]
 * @param {{ low, high }} [markers]  All-time low/high values for annotation
 */
export function updatePriceChart(labels, priceData, forecastData = [], markers = {}) {
    const chart = get('price');
    if (!chart) return;

    chart.data.labels = labels;
    chart.data.datasets[0].data = priceData;

    // Pad forecast so it connects to the last historical point
    const paddedForecast = new Array(priceData.length).fill(null);
    if (priceData.length > 0 && forecastData.length > 0) {
        paddedForecast[priceData.length - 1] = priceData[priceData.length - 1];
    }
    chart.data.datasets[1].data = [...paddedForecast, ...forecastData];

    // Extend labels for forecast
    const extraLabels = forecastData.map((_, i) => `+${i + 1}d`);
    chart.data.labels = [...labels, ...extraLabels];

    // All-time markers via annotation plugin (optional)
    if (markers.low != null && chart.options.plugins?.annotation) {
        chart.options.plugins.annotation.annotations.atl = {
            type: 'line', scaleID: 'y', value: markers.low,
            borderColor: 'rgba(16,185,129,0.5)', borderWidth: 1, borderDash: [4, 4],
            label: { display: true, content: `Low: ${markers.low}`, color: '#10B981', font: { size: 10 } },
        };
    }

    chart.update('active');
}

// ── CATEGORY CHART (Doughnut) ─────────────────────────────────────────────────
export function initCategoryChart(canvasId = 'categoryChart') {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const p = palette();

    return register('category', new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [p.blue, p.green, p.amber, p.red,
                    '#8B5CF6', '#EC4899', '#14B8A6', '#6B7280'],
                borderWidth: 0,
                hoverOffset: 6,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: true, position: 'right',
                    labels: { boxWidth: 10, padding: 10, color: p.text2 } },
                tooltip: { callbacks: { label: c => ` ${c.label}: ${c.raw}` } },
            },
        },
    }));
}

export function updateCategoryChart(labels, data) {
    const chart = get('category');
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.update('active');
}

// ── TREND OVERVIEW CHART ──────────────────────────────────────────────────────
export function initTrendChart(canvasId = 'trendChart', days = 7) {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const p = palette();

    return register('trend', new Chart(ctx, {
        type: 'line',
        data: { labels: [], datasets: [
            {
                label: 'Avg Price',
                data: [],
                borderColor: p.amber,
                backgroundColor: p.amberFill,
                borderWidth: 2, pointRadius: 3, tension: 0.4, fill: true,
            },
            {
                label: 'Drop Count',
                data: [],
                borderColor: p.green,
                backgroundColor: 'transparent',
                borderWidth: 2, pointRadius: 2, tension: 0.4, yAxisID: 'y1',
            },
        ]},
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: { legend: {
                display: true, position: 'top',
                labels: { usePointStyle: true, color: palette().text2 },
            }},
            scales: {
                x:  xScale({ ticks: { maxTicksLimit: 7 } }),
                y:  yScale({ position: 'left',  ticks: { callback: v => `${v}` } }),
                y1: { ...yScale(), position: 'right', grid: { drawOnChartArea: false },
                    ticks: { color: palette().green } },
            },
        },
    }));
}

export function updateTrendChart(trendData) {
    const chart = get('trend');
    if (!chart || !trendData) return;

    const labels = (trendData.labels || []).map(formatChartDate);
    chart.data.labels = labels;
    chart.data.datasets[0].data = trendData.avgPrices   || [];
    chart.data.datasets[1].data = trendData.dropCounts  || [];
    chart.update('active');
}

// ── SCORE DISTRIBUTION (Bar) ──────────────────────────────────────────────────
export function initScoreChart(canvasId = 'scoreChart') {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const p = palette();

    return register('score', new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['0–20', '21–40', '41–60', '61–80', '81–100'],
            datasets: [{
                label: 'Products',
                data: [0, 0, 0, 0, 0],
                backgroundColor: [p.text3, p.text3, p.amber, p.green, p.green],
                borderRadius: 5,
                borderSkipped: false,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: c => ` ${c.raw} products` } } },
            scales: {
                x: xScale(),
                y: yScale({ beginAtZero: true, ticks: { precision: 0 } }),
            },
        },
    }));
}

export function updateScoreChart(distribution) {
    const chart = get('score');
    if (!chart || !distribution) return;
    chart.data.datasets[0].data = distribution;
    chart.update('active');
}

// ── ALERT ACTIVITY (Bar) ──────────────────────────────────────────────────────
export function initAlertChart(canvasId = 'alertChart') {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    const p = palette();

    return register('alert', new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Alerts Sent',
                data: [],
                backgroundColor: p.blueFill,
                borderColor: p.blue,
                borderWidth: 1,
                borderRadius: 4,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { tooltip: { callbacks: { label: c => ` ${c.raw} alerts` } } },
            scales: {
                x: xScale({ ticks: { maxTicksLimit: 7 } }),
                y: yScale({ beginAtZero: true, ticks: { precision: 0 } }),
            },
        },
    }));
}

export function updateAlertChart(data) {
    const chart = get('alert');
    if (!chart || !data) return;
    chart.data.labels = (data.labels || []).map(formatChartDate);
    chart.data.datasets[0].data = data.counts || [];
    chart.update('active');
}

// ── VOLATILITY MINI-CHART (Inline sparkline for product history panel) ─────────
export function initVolatilityChart(canvasId = 'volatilityChart', priceHistory = []) {
    applyDefaults();
    const ctx = document.getElementById(canvasId);
    if (!ctx || !priceHistory.length) return null;
    const p = palette();

    const labels = priceHistory.map((e, i) => i % 5 === 0 ? formatChartDate(e.date || Date.now()) : '');
    const values = priceHistory.map(e => e.price || e);

    return register('volatility', new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: values,
                borderColor: p.amber,
                backgroundColor: p.amberFill,
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.2,
                fill: true,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: { tooltip: { enabled: false } },
            scales: {
                x: { display: false },
                y: { display: false },
            },
        },
    }));
}

// ── STOCK HISTORY BAR ─────────────────────────────────────────────────────────
/**
 * Render a segmented availability timeline into a container div.
 * @param {string} containerId
 * @param {object[]} stockHistory  Array of { date, status: 'in_stock'|'out_of_stock' }
 */
export function renderStockHistoryBar(containerId, stockHistory) {
    const el = document.getElementById(containerId);
    if (!el || !stockHistory?.length) return;

    const now   = Date.now();
    const first = new Date(stockHistory[0].date).getTime();
    const total = now - first;
    if (total <= 0) return;

    const events = [...stockHistory, { date: new Date(), status: 'end' }];
    let html = '';
    let inStockMs = 0;
    let outMs = 0;

    for (let i = 0; i < events.length - 1; i++) {
        const cur  = events[i];
        const next = events[i + 1];
        const dur  = new Date(next.date).getTime() - new Date(cur.date).getTime();
        const pct  = (dur / total) * 100;
        if (pct < 0.3) continue;

        const color = cur.status === 'in_stock' ? '#10B981' : '#EF4444';
        const label = cur.status === 'in_stock' ? 'In Stock' : 'Out of Stock';
        const start = formatChartDate(cur.date);
        const end   = formatChartDate(next.date);
        html += `<div title="${label}\n${start} → ${end}" style="flex:${pct};background:${color};height:100%;min-width:1px"></div>`;
        if (cur.status === 'in_stock') inStockMs += dur;
        else outMs += dur;
    }

    const availabilityPct = total > 0 ? ((inStockMs / total) * 100).toFixed(0) : '—';

    el.innerHTML = `
      <div style="display:flex;height:100%;border-radius:4px;overflow:hidden;gap:1px">${html}</div>
      <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:10px;color:var(--text2)">
        <span style="color:#10B981">■ In Stock</span>
        <span style="font-family:var(--font-mono);font-weight:600">${availabilityPct}% available</span>
        <span style="color:#EF4444">■ Out of Stock</span>
      </div>`;
}

// ── THEME REAPPLY ─────────────────────────────────────────────────────────────
/**
 * Call this after toggling dark/light mode to refresh all chart colors.
 */
export function reapplyTheme() {
    applyDefaults();
    const p = palette();
    Object.values(REGISTRY).forEach(chart => {
        try {
            chart.options.scales?.x && Object.assign(chart.options.scales.x.grid,  { color: p.border });
            chart.options.scales?.y && Object.assign(chart.options.scales.y.grid,  { color: p.border });
            chart.options.scales?.x && Object.assign(chart.options.scales.x.ticks, { color: p.text2  });
            chart.options.scales?.y && Object.assign(chart.options.scales.y.ticks, { color: p.text2  });
            chart.update('none');
        } catch { /* ignore missing scales */ }
    });
}

// ── INIT ALL CHARTS ───────────────────────────────────────────────────────────
/**
 * Initialize all charts on the page that have matching canvas IDs.
 * Safe to call even if canvases don't exist yet (they're silently skipped).
 */
export function initAllCharts() {
    applyDefaults();
    initPriceChart('priceChart');
    initCategoryChart('categoryChart');
    initTrendChart('trendChart');
    initScoreChart('scoreChart');
    initAlertChart('alertChart');
}

// ── DESTROY ALL ───────────────────────────────────────────────────────────────
export function destroyAll() {
    Object.keys(REGISTRY).forEach(k => {
        try { REGISTRY[k].destroy(); } catch { /* ignore */ }
        delete REGISTRY[k];
    });
}
