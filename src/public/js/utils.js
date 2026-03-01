// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — utils.js
// Upgrades over v1:
//  • Multi-currency formatPrice (not just EGP/USD)
//  • formatPriceChange, formatPercent helpers
//  • Relative time formatting (formatAgo) replacing manual code
//  • throttle (complements existing debounce)
//  • generateSparklineSVG (replaces inline template strings in UI)
//  • copyToClipboard with async fallback
//  • shareDeal with richer text & no alert()
//  • CSV builder utility
//  • ASIN extractor from URLs
//  • Semantic score helpers
// ─────────────────────────────────────────────────────────────────────────────

import { CURRENCIES, STATE, CONFIG } from './config.js';

// ── PRICE FORMATTING ──────────────────────────────────────────────────────────

/**
 * Format a price value in the current (or specified) currency.
 * @param {number} priceInEGP  The raw price stored in EGP
 * @param {string} [currency]  Override currency (defaults to STATE.currentCurrency)
 * @returns {string}  e.g. "EGP 1,250.00" or "$25.00"
 */
export function formatPrice(priceInEGP, currency) {
    if (priceInEGP == null || isNaN(priceInEGP)) return '—';
    const cur = CURRENCIES[currency || STATE.currentCurrency] || CURRENCIES.EGP;
    const converted = priceInEGP * cur.rate;
    try {
        return new Intl.NumberFormat(cur.locale, {
            style:    'currency',
            currency: currency || STATE.currentCurrency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(converted);
    } catch {
        // Fallback if currency code not supported by Intl
        return `${cur.symbol} ${converted.toFixed(2)}`;
    }
}

/**
 * Format a raw percent change value for display.
 * @param {number} pct  e.g. -24.5
 * @returns {string}  e.g. "↓ 24.5%" in green context, "↑ 5.0%" in red
 */
export function formatPercent(pct) {
    if (pct == null || isNaN(pct)) return '—';
    const abs = Math.abs(pct);
    const arrow = pct < 0 ? '↓' : pct > 0 ? '↑' : '→';
    return `${arrow} ${abs.toFixed(abs < 1 ? 1 : 0)}%`;
}

/**
 * Format a price difference as a change badge string.
 */
export function formatPriceChange(oldPrice, newPrice, currency) {
    if (!oldPrice || !newPrice) return null;
    const diff = newPrice - oldPrice;
    const pct  = ((diff / oldPrice) * 100);
    return {
        diff,
        pct,
        direction: diff < 0 ? 'drop' : diff > 0 ? 'hike' : 'stable',
        formatted: `${formatPercent(pct)} (${formatPrice(Math.abs(diff), currency)})`,
    };
}

// ── RELATIVE TIME ─────────────────────────────────────────────────────────────

/**
 * Returns a human-readable relative time string.
 * @param {string|Date|number} date
 * @returns {string} e.g. "3m ago", "2h ago", "yesterday"
 */
export function formatAgo(date) {
    if (!date) return '—';
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 5)    return 'just now';
    if (seconds < 60)   return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 172800) return 'yesterday';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * Format a date to a short string for chart x-axis labels.
 */
export function formatChartDate(date) {
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── FUNCTION TIMING ───────────────────────────────────────────────────────────

/**
 * Debounce: delay execution until `wait` ms after last call.
 */
export function debounce(fn, wait) {
    let t;
    return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), wait);
    };
}

/**
 * Throttle: execute at most once per `limit` ms.
 */
export function throttle(fn, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            fn.apply(this, args);
            inThrottle = true;
            setTimeout(() => { inThrottle = false; }, limit);
        }
    };
}

// ── SPARKLINE SVG ─────────────────────────────────────────────────────────────

/**
 * Generate a lightweight inline SVG sparkline from a price history array.
 * @param {Array} history  Array of { price, date } or raw numbers
 * @param {'drop'|'hike'|'stable'} direction  Determines line color
 * @param {{ width, height }} [opts]
 * @returns {string}  SVG markup string
 */
export function generateSparklineSVG(history, direction = 'stable', opts = {}) {
    const W = opts.width  || 200;
    const H = opts.height || 40;

    // Extract price values
    const prices = (history || [])
        .slice(-24)
        .map(h => (typeof h === 'number' ? h : h?.price))
        .filter(v => v != null && !isNaN(v));

    if (prices.length < 2) {
        return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
          <line x1="0" y1="${H/2}" x2="${W}" y2="${H/2}"
            stroke="var(--border2)" stroke-width="1.5" stroke-dasharray="4 4"/>
        </svg>`;
    }

    const min   = Math.min(...prices);
    const max   = Math.max(...prices);
    const range = max - min || 1;
    const PAD   = 4;

    const toX = i => (i / (prices.length - 1)) * W;
    const toY = v => H - PAD - ((v - min) / range) * (H - PAD * 2);

    const pts = prices.map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
    const lastX = toX(prices.length - 1).toFixed(1);
    const lastY = toY(prices[prices.length - 1]).toFixed(1);

    const COLOR = direction === 'drop'
        ? 'var(--green)'
        : direction === 'hike'
            ? 'var(--red)'
            : 'var(--blue)';
    const FILL = direction === 'drop'
        ? 'rgba(16,185,129,0.08)'
        : direction === 'hike'
            ? 'rgba(239,68,68,0.07)'
            : 'rgba(59,130,246,0.07)';

    // Area fill polygon
    const areaPoints = `${pts.join(' ')} ${lastX},${H} 0,${H}`;

    return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
      <polygon points="${areaPoints}" fill="${FILL}"/>
      <polyline points="${pts.join(' ')}"
        fill="none" stroke="${COLOR}" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lastX}" cy="${lastY}" r="3" fill="${COLOR}"/>
    </svg>`;
}

// ── SCORE SEMANTICS ───────────────────────────────────────────────────────────

/**
 * Derive color, label, and emoji from a smart score (0-100).
 */
export function scoreSemantics(score) {
    const s = Math.round(score || 0);
    if (s >= CONFIG.SCORE_HOT_THRESHOLD) {
        return { color: 'var(--green)', label: 'Strong Buy',   emoji: '🔥', cssClass: 'score-hot'  };
    }
    if (s >= CONFIG.SCORE_GOOD_THRESHOLD) {
        return { color: 'var(--amber)', label: 'Decent Deal',  emoji: '🙂', cssClass: 'score-good' };
    }
    return     { color: 'var(--text3)', label: 'Monitor',      emoji: '😐', cssClass: 'score-low'  };
}

/**
 * Map a deal label string to a rendered badge HTML string.
 */
export function dealLabelBadge(label) {
    const map = {
        hot_deal:    '<span class="badge badge-hot">🔥 Hot</span>',
        good_deal:   '<span class="badge badge-good">✅ Good</span>',
        fair_price:  '<span class="badge badge-fair">🙂 Fair</span>',
        stable:      '<span class="badge badge-stable">➡️ Stable</span>',
        price_hike:  '<span class="badge badge-hike">⬆️ Hike</span>',
    };
    return map[label] || '';
}

// ── CLIPBOARD & SHARING ───────────────────────────────────────────────────────

/**
 * Copy text to clipboard. Returns a Promise resolving to true/false.
 */
export async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        // Fallback for older browsers / blocked contexts
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity  = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
    }
}

/**
 * Share a deal via Web Share API or copy to clipboard as fallback.
 * Does NOT use alert().
 * @param {object} deal  { asin, title, currentPrice, url }
 * @param {function} onCopied  Called with true if clipboard fallback was used
 */
export function shareDeal(deal, onCopied) {
    const url   = deal.url || `https://www.amazon.com/dp/${deal.asin}`;
    const price = deal.currentPrice ? formatPrice(deal.currentPrice) : '';
    const text  = `🔥 Deal Alert!\n${deal.title || deal.name || deal.asin}\nPrice: ${price}\n${url}`;

    if (navigator.share) {
        navigator.share({ title: 'Trackzoon Deal', text, url }).catch(() => {});
    } else {
        copyToClipboard(text).then(ok => { if (onCopied) onCopied(ok); });
    }
}

// ── ASIN EXTRACTION ───────────────────────────────────────────────────────────

/**
 * Extract an ASIN from an Amazon URL or return the string if it already looks like an ASIN.
 * Handles /dp/B0..., /gp/product/B0..., amazon.eg, amazon.com, short amzn.to links etc.
 */
export function extractAsin(input) {
    if (!input) return null;
    // Already an ASIN?
    if (/^[A-Z0-9]{10}$/.test(input.trim())) return input.trim();
    // Try common patterns
    const patterns = [
        /\/dp\/([A-Z0-9]{10})/,
        /\/gp\/product\/([A-Z0-9]{10})/,
        /\/([A-Z0-9]{10})(?:\/|\?|$)/,
    ];
    for (const re of patterns) {
        const m = input.match(re);
        if (m) return m[1];
    }
    return null;
}

/**
 * Return true if the string looks like an Amazon URL or ASIN.
 */
export function isAmazonInput(input) {
    if (!input) return false;
    return /^[A-Z0-9]{10}$/.test(input.trim()) || /amazon\.|amzn\./.test(input);
}

// ── CSV BUILDER ───────────────────────────────────────────────────────────────

/**
 * Convert an array of objects to a CSV string.
 * @param {object[]} rows
 * @param {string[]} [columns]  Column keys to include (defaults to all keys of first row)
 * @returns {string}
 */
export function buildCSV(rows, columns) {
    if (!rows || !rows.length) return '';
    const cols = columns || Object.keys(rows[0]);
    const escape = v => {
        const s = String(v == null ? '' : v);
        return s.includes(',') || s.includes('"') || s.includes('\n')
            ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.join(',');
    const body   = rows.map(r => cols.map(c => escape(r[c])).join(','));
    return [header, ...body].join('\n');
}

/**
 * Trigger a browser download of text content as a file.
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ── DOM HELPERS ───────────────────────────────────────────────────────────────

/** Safely get an element, returns null without throwing. */
export const $ = id => document.getElementById(id);

/** Set text of an element by id, no-op if element missing. */
export function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

/** Toggle a CSS class on an element by id. */
export function toggleClass(id, cls, force) {
    const el = $(id);
    if (el) el.classList.toggle(cls, force);
}

/** Animate a number counter in an element */
export function animateNumber(el, end, duration = 900, formatter = v => v.toLocaleString()) {
    if (!el) return;
    const start = 0;
    const t0    = performance.now();
    const tick  = now => {
        const p = Math.min((now - t0) / duration, 1);
        // Ease-out cubic
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = formatter(Math.round(eased * end));
        if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}
