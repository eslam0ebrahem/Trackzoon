// ─────────────────────────────────────────────────────────────────────────────
// Trackzoon v2 — ui.js
// Complete rewrite of all UI rendering functions.
// Upgrades over v1:
//  • No more alert() — all feedback via toast (Bus events)
//  • All deal/product renders use the v2 card design
//  • showProductHistory is fully rebuilt with all analytics widgets
//  • renderLogs with filtering, level coloring, live reload
//  • renderStockHistory delegates to charts.js
//  • openAddProductModal / closeAddProductModal now manage the slide panel
//  • All elements referenced via $ (safe null-check helper from utils)
// ─────────────────────────────────────────────────────────────────────────────

import { STATE, CONFIG, Bus }              from './config.js';
import { API }                              from './api.js';
import {
    formatPrice, formatPercent, formatAgo,
    generateSparklineSVG, scoreSemantics, dealLabelBadge,
    $, setText, animateNumber, copyToClipboard,
} from './utils.js';
import {
    updatePriceChart, initPriceChart, renderStockHistoryBar,
    reapplyTheme,
} from './charts.js';

// ── STATS ─────────────────────────────────────────────────────────────────────
export function renderStats(data) {
    if (!data) return;
    animateNumber($('stat-products'),  data.totalProducts     || 0);
    animateNumber($('stat-deals'),     data.activeDeals       || data.totalTrackedItems || 0);
    animateNumber($('stat-users'),     data.totalUsers        || 0);
    const avgDrop = $('stat-avgdrop');
    if (avgDrop) avgDrop.textContent = data.avgDiscount ? `${data.avgDiscount.toFixed(1)}%` : '—';
    const navBadge = $('navDealsCount');
    if (navBadge) navBadge.textContent = data.hotDeals || 0;
}

// ── DEALS LIST ────────────────────────────────────────────────────────────────
export function renderDeals(deals, container, append = false) {
    if (!container) return;
    if (!append) container.innerHTML = '';

    if (!deals?.length) {
        if (!append) {
            container.innerHTML = `
              <div class="empty-state" style="grid-column:1/-1">
                <div class="icon">🔍</div>
                <h3>No deals found</h3>
                <p>Try adjusting your filters or track more products.</p>
              </div>`;
        }
        return;
    }

    const html = deals.map(renderDealCard).join('');
    if (append) container.insertAdjacentHTML('beforeend', html);
    else container.innerHTML = html;
}

function renderDealCard(deal) {
    const p       = deal.product || deal;
    const pct     = deal.percentChange ?? deal.discountPercentage ?? 0;
    const isDrop  = pct < 0;
    const isHike  = pct > 0;
    const dir     = isDrop ? 'drop' : isHike ? 'hike' : 'stable';
    const score   = Math.round(deal.smartScore || p.smartScore || 0);
    const sem     = scoreSemantics(score);
    const curFmt  = formatPrice(p.currentPrice);
    const oldFmt  = p.previousPrice || p.oldPrice;
    const asin    = p.asin || '';
    const title   = p.title || p.name || 'Amazon Product';
    const img     = p.imageUrl || p.image || '';
    const oos     = p.isOutOfStock || p.outOfStock;
    const timeAgo = formatAgo(deal.lastChecked || p.lastChecked);
    const badge   = dealLabelBadge(deal.dealLabel || p.dealLabel);
    const sparkSVG = generateSparklineSVG(p.priceHistory || [], dir);

    // Score gauge
    const circum = 2 * Math.PI * 18;
    const dash   = (score / 100) * circum;

    return `
    <div class="deal-card"
         data-asin="${asin}"
         oncontextmenu="window.TZ.openCtxMenu(event,'${asin}')"
         onclick="window.TZ.handleCardClick(event,'${asin}','${encodeURIComponent(title)}')"
    >
      ${oos ? '<div class="out-of-stock-overlay">⊗ OUT OF STOCK</div>' : ''}

      <div class="deal-card-header">
        <div class="deal-img">
          ${img
            ? `<img src="${img}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='📦'">`
            : '📦'}
        </div>
        <div class="deal-info">
          <div class="deal-title" title="${title.replace(/"/g,"'")}">${title}</div>
          <div class="deal-badges">
            ${badge}
            ${asin ? `<span class="badge" style="background:var(--bg3);color:var(--text3);border:1px solid var(--border)">${asin}</span>` : ''}
          </div>
        </div>
      </div>

      <div class="deal-card-body">
        <div class="deal-price-row">
          <div style="display:flex;align-items:baseline;gap:8px">
            <span class="deal-price ${dir}">${curFmt}</span>
            ${oldFmt ? `<span class="deal-old-price">${formatPrice(oldFmt)}</span>` : ''}
          </div>
          <span class="deal-change-badge ${dir}">
            ${pct !== 0 ? formatPercent(pct) : '→ stable'}
          </span>
        </div>
        <div class="sparkline-wrap">${sparkSVG}</div>
        <div class="score-section">
          <div class="score-gauge">
            <svg viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="18" fill="none" stroke="var(--border2)" stroke-width="4"/>
              <circle cx="24" cy="24" r="18" fill="none"
                stroke="${sem.color}" stroke-width="4"
                stroke-dasharray="${dash.toFixed(1)} ${circum.toFixed(1)}"
                stroke-linecap="round"
                style="transition:stroke-dasharray 1s ease"/>
            </svg>
            <span class="score-num" style="color:${sem.color}">${score}</span>
          </div>
          <div class="score-details">
            <div class="score-label">Deal Score ${sem.emoji}</div>
            <div class="confidence-bar-wrap">
              <div class="confidence-bar" style="width:${score}%;background:${sem.color}"></div>
            </div>
            <div style="font-size:10px;color:var(--text3);margin-top:4px;font-family:var(--font-mono)">${sem.label}</div>
          </div>
        </div>
      </div>

      <div class="deal-card-footer">
        <button class="deal-action"
          onclick="event.stopPropagation();window.TZ.loadHistory('${asin}','${encodeURIComponent(title)}')">
          📈 History
        </button>
        <button class="deal-action"
          onclick="event.stopPropagation();window.TZ.shareCard('${asin}')">
          📤
        </button>
        ${asin
            ? `<a class="deal-action primary"
                 href="https://www.amazon.com/dp/${asin}"
                 target="_blank"
                 rel="noopener noreferrer"
                 onclick="event.stopPropagation()">
                 View on Amazon ↗
               </a>`
            : ''}
        <span class="deal-time">${timeAgo}</span>
      </div>
    </div>`;
}

// ── RECENT ACTIVITY ───────────────────────────────────────────────────────────
export function renderRecent(products) {
    const container = $('recentActivity');
    if (!container) return;
    if (!products?.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px">No recent activity</div>';
        return;
    }
    container.innerHTML = products.map(p => `
      <div class="notif-item" onclick="window.TZ.loadHistory('${p.asin}','${encodeURIComponent(p.name||p.title||p.asin)}')">
        <div class="notif-dot" style="background:${p.isOutOfStock ? 'var(--red)' : 'var(--green)'}"></div>
        <div>
          <div class="notif-msg">${(p.name || p.title || p.asin).substring(0, 48)}</div>
          <div class="notif-time">${formatAgo(p.lastChecked)} · ${formatPrice(p.currentPrice)}</div>
        </div>
      </div>`).join('');
}

// ── TOP TRACKED ───────────────────────────────────────────────────────────────
export function renderTopTracked(products) {
    const container = $('topTracked');
    if (!container) return;
    if (!products?.length) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text2);font-size:13px">No tracked items yet</div>';
        return;
    }
    container.innerHTML = products.map((p, i) => `
      <div class="notif-item" onclick="window.TZ.loadHistory('${p.asin}','${encodeURIComponent(p.name||p.asin)}')">
        <span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);min-width:20px">#${i + 1}</span>
        <div style="flex:1;min-width:0">
          <div class="notif-msg">${(p.name || p.asin).substring(0, 40)}</div>
          <div class="notif-time" style="color:var(--blue)">${p.trackerCount} tracker${p.trackerCount !== 1 ? 's' : ''}</div>
        </div>
        <span style="font-family:var(--font-mono);font-size:12px;font-weight:600">${formatPrice(p.currentPrice)}</span>
      </div>`).join('');
}

// ── BEST DROPS ────────────────────────────────────────────────────────────────
export function renderBestDrops(items) {
    const container = $('bestDropsList');
    if (!container) return;
    if (!items?.length) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:12px">No major drops recently</div>';
        return;
    }
    container.innerHTML = items.map(item => {
        const pct = item.percentChange || item.dropPercent || 0;
        return `
        <div class="notif-item" onclick="window.TZ.loadHistory('${item.asin}','${encodeURIComponent(item.name||item.asin)}')">
          <span style="font-family:var(--font-mono);font-size:13px;font-weight:700;color:var(--green);min-width:50px">
            ↓ ${Math.abs(pct).toFixed(0)}%
          </span>
          <div style="flex:1;min-width:0">
            <div class="notif-msg">${(item.name || item.asin).substring(0, 40)}</div>
            <div class="notif-time">${formatAgo(item.checkedAt || item.date)}</div>
          </div>
          <span style="font-family:var(--font-mono);font-size:12px;color:var(--green)">
            ${formatPrice(item.newPrice || item.currentPrice)}
          </span>
        </div>`;
    }).join('');
}

// ── DEAL OPPORTUNITIES ────────────────────────────────────────────────────────
export function renderDealOpportunities(items) {
    const container = $('dealOpportunitiesList');
    if (!container) return;
    if (!items?.length) {
        container.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:12px">No opportunities found</div>';
        return;
    }
    container.innerHTML = items.map(item => {
        const score = Math.round(item.smartScore || 0);
        const sem   = scoreSemantics(score);
        return `
        <div class="notif-item" onclick="window.TZ.loadHistory('${item.asin}','${encodeURIComponent(item.name||item.asin)}')">
          <span style="font-family:var(--font-mono);font-size:11px;font-weight:700;
            color:${sem.color};background:var(--bg3);border:1px solid var(--border);
            padding:2px 6px;border-radius:5px;flex-shrink:0">${score}</span>
          <div style="flex:1;min-width:0">
            <div class="notif-msg">${(item.name || item.asin).substring(0, 40)}</div>
            <div class="notif-time">${sem.label}</div>
          </div>
          <span style="font-family:var(--font-mono);font-size:12px;font-weight:600">
            ${formatPrice(item.currentPrice)}
          </span>
        </div>`;
    }).join('');
}

// ── TICKER ────────────────────────────────────────────────────────────────────
export function updateTicker(products) {
    const ticker = $('tickerTrack');
    if (!ticker || !products?.length) return;

    const makeItem = p => {
        const pct  = p.percentChange || p.lastPriceChange?.percent || 0;
        const dir  = pct < 0 ? 't-drop' : pct > 0 ? 't-hike' : '';
        const arrow = pct < 0 ? '▼' : pct > 0 ? '▲' : '—';
        const name  = (p.name || p.title || p.asin || '').split(' ').slice(0, 4).join(' ');
        const asin  = p.asin || '';
        return `<span class="ticker-item"
            onclick="window.TZ.loadHistory('${asin}','${encodeURIComponent(name)}')">
            ${p.isOutOfStock ? '🔴' : '🟢'} ${name}
            <span class="t-price">${formatPrice(p.currentPrice)}</span>
            <span class="${dir}">${arrow}${pct ? Math.abs(pct).toFixed(1) + '%' : ''}</span>
          </span>`;
    };

    // Duplicate for seamless loop
    const items = products.slice(0, CONFIG.MAX_TICKER_ITEMS);
    ticker.innerHTML = [...items, ...items].map(makeItem).join('');
}

// ── HEALTH STATUS ─────────────────────────────────────────────────────────────
export function updateHealth(data) {
    const el = $('healthStatus');
    if (!el) return;
    const dot  = el.querySelector('div');
    const text = el.querySelector('span');
    if (!dot || !text) return;

    if (data?.status === 'ok') {
        dot.style.background = 'var(--green)';
        dot.classList.remove('animate-pulse');
        text.textContent = 'Online';
        const h = Math.floor((data.uptime || 0) / 3600);
        const m = Math.floor(((data.uptime || 0) % 3600) / 60);
        el.title = `Uptime: ${h}h ${m}m${data.memory ? ` · Heap: ${data.memory.heapUsed}` : ''}`;
    } else {
        throw new Error('status not ok');
    }
}

export function updateHealthError() {
    const el = $('healthStatus');
    if (!el) return;
    const dot  = el.querySelector('div');
    const text = el.querySelector('span');
    if (dot)  dot.style.background  = 'var(--red)';
    if (text) text.textContent = 'Offline';
}

// ── PRODUCT HISTORY PANEL ─────────────────────────────────────────────────────
/**
 * Fully renders the product history panel with all analytics widgets.
 * @param {object} data          History API response (product info + priceHistory)
 * @param {string} asin
 * @param {object} analytics     { forecast, volatility, bestDay, stockHistory, dealIntelligence }
 */
export function showProductHistory(data, asin, analytics = {}) {
    STATE.currentAsin = asin;

    // ── Basic info ────────────────────────────────────────────────────────────
    const panel = $('historyPanel');
    if (panel) {
        panel.classList.add('visible');
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const nameEl = $('chartTitle');
    if (nameEl) nameEl.textContent = data.name || data.title || asin;

    const priceEl = $('chartPrice');
    if (priceEl) priceEl.textContent = formatPrice(data.currentPrice);

    const linkEl = $('chartLink');
    if (linkEl) linkEl.href = `https://www.amazon.com/dp/${asin}`;

    // Show download button
    const csvBtn = $('downloadCsvBtn');
    if (csvBtn) csvBtn.classList.remove('hidden');

    // Show management fields
    const productInfo = $('productInfo');
    if (productInfo) productInfo.classList.remove('hidden');

    const placeholder = $('chartPlaceholder');
    if (placeholder) placeholder.classList.add('hidden');

    // Tags & target
    const tagsEl = $('productTags');
    if (tagsEl) tagsEl.value = data.tags?.join(', ') || '';

    const targetEl = $('productTargetPrice');
    if (targetEl) targetEl.value = data.thresholdPrice || '';

    // Archive button
    const archiveBtn = $('archiveBtn');
    if (archiveBtn) {
        if (data.isArchived) {
            archiveBtn.textContent = 'Unarchive';
            archiveBtn.className = archiveBtn.className.replace(/bg-\S+/g, 'bg-yellow-600 hover:bg-yellow-700');
        } else {
            archiveBtn.textContent = 'Archive';
        }
    }

    // ── Price chart ───────────────────────────────────────────────────────────
    const history = data.priceHistory || [];
    const labels  = history.map(h => formatAgo(h.date));
    const prices  = history.map(h => h.price);

    const forecastPrices = analytics.forecast?.forecast?.map(f => f.price) || [];
    const allPrices = [...prices, ...forecastPrices].filter(Boolean);
    const atl = allPrices.length ? Math.min(...allPrices) : null;
    const ath = allPrices.length ? Math.max(...allPrices) : null;

    // Ensure chart is initialized
    if (!$('priceChart')?._chartInstance) initPriceChart();
    updatePriceChart(labels, prices, forecastPrices, { low: atl, high: ath });

    // ── History stats row ─────────────────────────────────────────────────────
    const statsEl = $('historyStats');
    if (statsEl && prices.length) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
        statsEl.innerHTML = `
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:600;color:var(--green)">${formatPrice(atl)}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px">All-time Low</div>
          </div>
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:600;color:var(--amber)">${formatPrice(avg)}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px">Average Price</div>
          </div>
          <div style="background:var(--bg3);border-radius:8px;padding:12px;text-align:center">
            <div style="font-family:var(--font-mono);font-size:18px;font-weight:600;color:var(--red)">${formatPrice(ath)}</div>
            <div style="font-size:11px;color:var(--text2);margin-top:4px">All-time High</div>
          </div>`;
    }

    // ── Volatility widget ─────────────────────────────────────────────────────
    if (analytics.volatility) {
        setText('volatilityLabel', analytics.volatility.label || '—');
        setText('volatilityScore', analytics.volatility.score ?? '—');
        const bar = $('volatilityBar');
        if (bar) bar.style.width = `${(analytics.volatility.score || 0) * 10}%`;
    }

    // ── Best day to buy ───────────────────────────────────────────────────────
    if (analytics.bestDay) {
        setText('bestDayLabel', analytics.bestDay.dayName || '—');
        setText('bestDayPrice', formatPrice(analytics.bestDay.averagePrice));
    } else {
        setText('bestDayLabel', 'N/A');
        setText('bestDayPrice', '—');
    }

    // ── Forecast widget ───────────────────────────────────────────────────────
    if (analytics.forecast) {
        const trendEl = $('forecastTrend');
        const confEl  = $('forecastConfidence');
        const trend   = String(analytics.forecast.trend || '').toUpperCase();
        const isDown  = trend === 'DOWN' || trend === 'DROP' || trend === 'FALL';
        const isUp    = trend === 'UP'   || trend === 'RISE';
        if (trendEl) {
            trendEl.textContent  = isDown ? '📉 Falling' : isUp ? '📈 Rising' : '➡️ Stable';
            trendEl.style.color  = isDown ? 'var(--green)' : isUp ? 'var(--red)' : 'var(--text2)';
        }
        if (confEl) {
            const conf = analytics.forecast.confidence;
            confEl.textContent = conf != null ? `Confidence: ${(conf * 100).toFixed(0)}%` : '';
        }
    }

    // ── Stock history bar ─────────────────────────────────────────────────────
    if (analytics.stockHistory?.length) {
        renderStockHistoryBar('stockHistoryBar', analytics.stockHistory);
    }

    // ── Deal intelligence ─────────────────────────────────────────────────────
    _renderDealIntelligence(analytics.dealIntelligence);
}

function _renderDealIntelligence(intel) {
    if (!intel) return;

    const fields = [
        ['diRecommendation', intel.recommendation],
        ['diConfidence',     intel.confidence != null ? `${(intel.confidence * 100).toFixed(0)}%` : null],
        ['diDropProbability', intel.dropProbability != null ? `${(intel.dropProbability * 100).toFixed(0)}%` : null],
        ['diBestPrice',      intel.bestPrice != null ? formatPrice(intel.bestPrice) : null],
        ['diSavings',        intel.potentialSavings != null ? formatPrice(intel.potentialSavings) : null],
        ['diWaitDays',       intel.recommendedWaitDays != null ? `${intel.recommendedWaitDays} days` : null],
        ['diRisk',           intel.riskLevel],
        ['diSeasonality',    intel.seasonalityNote || (intel.hasSeasonality ? 'Seasonal pattern detected' : 'No seasonality signal')],
        ['diNarrative',      intel.narrative || intel.advice],
    ];

    fields.forEach(([id, value]) => {
        if (value != null) setText(id, value);
    });
}

// ── TOP CATEGORIES ────────────────────────────────────────────────────────────
export function renderTopCategories(categories) {
    const container = $('topCategoriesList');
    if (!container) return;
    if (!categories?.length) {
        container.innerHTML = '<div style="font-size:12px;color:var(--text3)">No category data</div>';
        return;
    }
    container.innerHTML = categories.map(c => `
      <div style="display:flex;align-items:center;justify-content:space-between;font-size:12px;color:var(--text2);padding:3px 0">
        <span class="truncate">${c.category || c._id || '—'}</span>
        <span style="color:var(--text3);white-space:nowrap;margin-left:8px;font-family:var(--font-mono)">
          ${c.count} · ${(c.avgDiscount || 0).toFixed(1)}% avg
        </span>
      </div>`).join('');
}

// ── DEAL SCORE DISTRIBUTION ───────────────────────────────────────────────────
export function renderScoreDistribution(deals) {
    // Bucket deal scores into 5 ranges
    const buckets = [0, 0, 0, 0, 0];
    (deals || []).forEach(d => {
        const s = Math.round(d.smartScore || 0);
        const idx = Math.min(4, Math.floor(s / 20));
        buckets[idx]++;
    });
    Bus.emit('score:update', buckets);
}

// ── LOGS ──────────────────────────────────────────────────────────────────────
export function renderLogs(logs) {
    const container = $('logsList');
    if (!container) return;
    if (!logs?.length) {
        container.innerHTML = '<div style="color:var(--text3);font-size:12px;padding:8px">No log entries</div>';
        return;
    }
    const levelColor = { error: 'var(--red)', warn: 'var(--amber)', info: 'var(--green)', debug: 'var(--text3)' };
    container.innerHTML = logs.map(log => `
      <div style="display:flex;gap:10px;padding:3px 0;border-bottom:1px solid var(--border);font-size:11px">
        <span style="color:var(--text3);white-space:nowrap;font-family:var(--font-mono)">
          [${new Date(log.time || log.timestamp || Date.now()).toLocaleTimeString()}]
        </span>
        <span style="color:${levelColor[log.level] || 'var(--text2)'};text-transform:uppercase;width:40px;font-family:var(--font-mono);flex-shrink:0">${log.level}</span>
        <span style="color:var(--text2);word-break:break-word">${log.message}</span>
      </div>`).join('');
}

let _logsVisible = false;
export function toggleLogs() {
    const el = $('logsSection');
    if (!el) return false;
    _logsVisible = !_logsVisible;
    el.style.display = _logsVisible ? '' : 'none';
    return _logsVisible;
}

// ── ADD PRODUCT MODAL ─────────────────────────────────────────────────────────
/** Open the slide-in Quick Add panel */
export function openAddProductModal() {
    const panel = $('quickAddPanel');
    if (panel) panel.classList.add('open');
}

/** Close the Quick Add panel and reset form */
export function closeAddProductModal() {
    const panel = $('quickAddPanel');
    if (panel) panel.classList.remove('open');
    const urlInput = $('qaUrl');
    if (urlInput) urlInput.value = '';
    const preview = $('previewBox');
    if (preview) { preview.classList.remove('visible'); preview.innerHTML = ''; }
}

// ── SEARCH RESULTS ────────────────────────────────────────────────────────────
export function renderSearchResults(results, container) {
    if (!container) return;
    if (!results?.length) {
        container.innerHTML = '<div style="padding:10px 16px;font-size:13px;color:var(--text3)">No results found</div>';
        container.classList.remove('hidden');
        return;
    }
    container.innerHTML = results.map(p => `
      <div style="padding:10px 16px;display:flex;align-items:center;justify-content:space-between;
          cursor:pointer;transition:background 0.1s;border-bottom:1px solid var(--border)"
          onmouseover="this.style.background='var(--bg3)'"
          onmouseout="this.style.background=''"
          onclick="window.TZ.loadHistory('${p.asin}','${encodeURIComponent(p.name||p.asin)}');document.getElementById('searchResults')?.classList.add('hidden')">
        <span style="font-size:13px;color:var(--text);max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${p.name || p.title || p.asin}
        </span>
        <span style="font-family:var(--font-mono);font-size:12px;color:var(--amber);margin-left:10px">
          ${formatPrice(p.currentPrice)}
        </span>
      </div>`).join('');
    container.classList.remove('hidden');
}

// ── ADMIN STATS ───────────────────────────────────────────────────────────────
export function renderAdminStats(health, dbStats, extStats) {
    // Health
    const ok  = v => v === true || v === 'ok' || v === 'connected' || v === 'up';
    const cls = v => ok(v) ? 'status-ok' : 'status-err';

    const setAdmin = (id, val, statusVal) => {
        const el = $(id);
        if (!el) return;
        el.textContent = val;
        if (statusVal !== undefined) el.className = `admin-stat-value ${cls(statusVal)}`;
    };

    if (health) {
        setAdmin('adm-api',   'Online',                     true);
        setAdmin('adm-db',    ok(health.db)  ? 'Connected' : 'Error',   health.db);
        setAdmin('adm-queue', ok(health.redis) ? 'Active' : 'Inactive', health.redis);
        setAdmin('adm-sched', ok(health.scheduler) ? 'Running' : 'Stopped', health.scheduler);

        if (typeof health.ai === 'object' && health.ai) {
            const ai = health.ai;
            setAdmin('adm-aistate', ai.paused ? 'Paused' : 'Active', !ai.paused);
            setAdmin('adm-tokens',  ai.tokensToday != null ? `${ai.tokensToday.toLocaleString()} / ${(ai.tokenBudget||0).toLocaleString()}` : '—');
            setAdmin('adm-reqs',    ai.requestsToday ?? '—');
            setAdmin('adm-pause',   ai.pauseUntil ? formatAgo(ai.pauseUntil) : 'None');
        } else {
            setAdmin('adm-ai', ok(health.ai) ? 'Active' : 'Off', health.ai);
        }
    }

    if (dbStats) {
        setAdmin('adm-products', (dbStats.products  || 0).toLocaleString());
        setAdmin('adm-users',    (dbStats.users      || 0).toLocaleString());
        setAdmin('adm-metrics',  (dbStats.metrics    || 0).toLocaleString());
        setAdmin('adm-subs',     (dbStats.subscriptions || 0).toLocaleString());
        setAdmin('adm-alerts',   (dbStats.alertsSent24h || 0).toLocaleString());
    }

    if (extStats || health?.extension) {
        const e = extStats || health.extension;
        setAdmin('adm-syncs', e.totalSyncs   || '—');
        setAdmin('adm-newp',  e.newProducts  || '—');
        setAdmin('adm-upd',   e.updates      || '—');
        setAdmin('adm-errs',  e.errors       || '0');
    }
}

// ── THEME MANAGEMENT ──────────────────────────────────────────────────────────
export function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = $('themeBtn');
    if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
    const toggle = $('darkModeToggle');
    if (toggle) toggle.classList.toggle('on', theme === 'dark');
    // Refresh charts to match new palette
    reapplyTheme();
}

// ── CURRENCY TOGGLE ───────────────────────────────────────────────────────────
export function updateCurrencyDisplay() {
    const btn = $('currencyToggle');
    if (btn) btn.textContent = STATE.currentCurrency;
}

// ── TOAST (internal use from UI layer) ───────────────────────────────────────
export function showToast(msg, type = 'info') {
    Bus.emit('toast', { msg, type });
}
