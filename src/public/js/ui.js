import { STATE } from './config.js';
import { formatPrice, shareDeal } from './utils.js';
import { API } from './api.js';
import { updatePriceChart } from './charts.js';
// Removed circular dependency import { fetchDeals } from './app.js'

export const UI = {
    renderStats(data) {
        document.getElementById('totalProducts').textContent = data.totalProducts;
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('totalTracked').textContent = data.totalTrackedItems;
    },

    renderDeals(deals, container, append = false) {
        if (!append) container.innerHTML = '';

        const html = deals.map(deal => {
            const p = deal.product;
            const isDrop = deal.percentChange < 0;
            const isHike = deal.percentChange > 0;

            // Label Badge Logic
            let labelBadge = '';
            if (deal.dealLabel === 'hot_deal') labelBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">🔥 HOT</span>';
            else if (deal.dealLabel === 'good_deal') labelBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">✅ Good</span>';
            else if (deal.dealLabel === 'price_hike') labelBadge = '<span class="px-2 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">⚠️ Hike</span>';

            // Score Badge Logic
            const score = Math.round(deal.smartScore || 0);
            let scoreColor = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
            let scoreIcon = '😐';

            if (score >= 70) {
                scoreColor = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
                scoreIcon = '🔥';
            } else if (score >= 40) {
                scoreColor = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
                scoreIcon = '🙂';
            }

            const scoreBadge = `<span class="px-2 py-0.5 rounded text-xs font-bold ${scoreColor} flex items-center gap-1" title="Smart Score: ${score}/100">${scoreIcon} ${score}</span>`;

            // Price Color
            const priceColor = isDrop ? 'text-green-600 dark:text-green-400' : (isHike ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white');
            const arrow = isDrop ? '↓' : (isHike ? '↑' : '');

            return `
            <div class="group bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center gap-4" onclick="window.loadHistory('${p.asin}')">
                
                <!-- 1. Icon (Replaced Image) -->
                <div class="w-16 h-16 flex-shrink-0 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800 p-1 flex items-center justify-center">
                    <svg class="w-8 h-8 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                    </svg>
                </div>

                <!-- 2. Main Info -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        ${labelBadge}
                        ${scoreBadge}
                    </div>
                    <h3 class="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 transition-colors">${p.name}</h3>
                    <div class="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
                        <span>${p.merchant || 'Amazon'}</span>
                        <span>•</span>
                        <span>${new Date(p.lastChecked).toLocaleDateString()}</span>
                    </div>
                </div>

                <!-- 3. Price & Action -->
                <div class="text-right">
                    <div class="text-lg font-bold ${priceColor} flex items-center justify-end gap-1">
                        <span>${formatPrice(deal.currentPrice)}</span>
                        ${(deal.discountPercentage || deal.percentChange) ? `<span class="text-xs bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">${arrow} ${Math.abs(deal.discountPercentage || deal.percentChange).toFixed(0)}%</span>` : ''}
                    </div>
                    ${deal.oldPrice ? `<div class="text-xs text-gray-400 line-through">${formatPrice(deal.oldPrice)}</div>` : ''}
                </div>

                <!-- 4. Quick Actions (Hover) -->
                <div class="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                    <a href="${p.url}" target="_blank" onclick="event.stopPropagation()" class="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                    </a>
                </div>
            </div>`;
        }).join('');

        if (append) container.insertAdjacentHTML('beforeend', html);
        else container.innerHTML = html;
    },

    renderRecent(products) {
        const container = document.getElementById('recentActivity');
        if (!products || products.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">No recent activity</p>
                </div>`;
            return;
        }
        container.innerHTML = products.map(p => `
            <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer flex items-center justify-between" onclick="window.loadHistory('${p.asin}')">
                <div class="flex items-center min-w-0">
                    <div class="w-2 h-2 rounded-full ${p.isOutOfStock ? 'bg-red-400' : 'bg-green-400'} mr-3"></div>
                    <div class="min-w-0">
                        <p class="text-xs font-medium text-gray-900 dark:text-white truncate w-32">${p.name}</p>
                        <p class="text-xs text-gray-500 dark:text-gray-400">${new Date(p.lastChecked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                </div>
                <span class="text-xs font-bold text-gray-700 dark:text-gray-300">EGP ${p.currentPrice}</span>
            </div>
        `).join('');
    },

    renderTopTracked(products) {
        const container = document.getElementById('topTracked');
        if (!products || products.length === 0) {
            container.innerHTML = `
                <div class="p-8 text-center">
                    <p class="text-sm text-gray-500 dark:text-gray-400">No tracked items yet</p>
                </div>`;
            return;
        }
        container.innerHTML = products.map((p, i) => `
            <div class="p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer flex items-center justify-between" onclick="window.loadHistory('${p.asin}')">
                <div class="flex items-center min-w-0">
                    <span class="text-xs font-bold text-gray-400 mr-3 w-4">#${i + 1}</span>
                    <div class="min-w-0">
                        <p class="text-xs font-medium text-gray-900 dark:text-white truncate w-32">${p.name}</p>
                        <p class="text-xs text-blue-500">${p.trackerCount} trackers</p>
                    </div>
                </div>
            </div>
        `).join('');
    },

    renderLogs(logs) {
        const html = logs.map(log => `
            <div class="flex space-x-2">
                <span class="text-gray-500">[${new Date(log.time).toLocaleTimeString()}]</span>
                <span class="${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-yellow-400' : 'text-green-400'} uppercase w-12">${log.level}</span>
                <span>${log.message}</span>
            </div>
        `).join('');
        document.getElementById('logsList').innerHTML = html;
    },

    updateTicker(products) {
        const ticker = document.getElementById('priceTicker');
        if (!products || products.length === 0) return;

        ticker.innerHTML = products.map(p => `
            <span class="ticker-item cursor-pointer hover:underline" onclick="window.loadHistory('${p.asin}')">
                ${p.isOutOfStock ? '🔴' : '🟢'} ${p.name.substring(0, 30)}...
                <span class="font-bold">EGP ${p.currentPrice}</span>
            </span>
        `).join('');
    },

    updateHealth(data) {
        const statusEl = document.getElementById('healthStatus');
        const dotEl = statusEl.querySelector('div');
        const textEl = statusEl.querySelector('span');

        if (data.status === 'ok') {
            dotEl.classList.remove('bg-gray-400', 'bg-red-500', 'animate-pulse');
            dotEl.classList.add('bg-green-500');
            textEl.textContent = 'Online';

            const hours = Math.floor(data.uptime / 3600);
            const minutes = Math.floor((data.uptime % 3600) / 60);
            statusEl.title = `Uptime: ${hours}h ${minutes}m | Memory: ${data.memory.heapUsed}`;
        } else {
            throw new Error('Status not ok');
        }
    },

    updateHealthError() {
        const statusEl = document.getElementById('healthStatus');
        const dotEl = statusEl.querySelector('div');
        const textEl = statusEl.querySelector('span');

        dotEl.classList.remove('bg-gray-400', 'bg-green-500', 'animate-pulse');
        dotEl.classList.add('bg-red-500');
        textEl.textContent = 'Offline';
    },

    showProductHistory(data, asin, analytics = {}) {
        STATE.currentAsin = asin;
        document.getElementById('productInfo').classList.remove('hidden');
        document.getElementById('chartPlaceholder').classList.add('hidden'); // Hide placeholder
        document.getElementById('downloadCsvBtn').classList.remove('hidden');
        document.getElementById('chartTitle').textContent = data.name;
        document.getElementById('chartPrice').textContent = `EGP ${data.currentPrice.toFixed(2)}`;
        document.getElementById('chartLink').href = `https://www.amazon.eg/dp/${asin}`;

        // Populate Management Fields
        document.getElementById('productTags').value = data.tags ? data.tags.join(', ') : '';
        document.getElementById('productTargetPrice').value = data.thresholdPrice || '';

        const archiveBtn = document.getElementById('archiveBtn');
        if (data.isArchived) {
            archiveBtn.textContent = 'Unarchive';
            archiveBtn.className = 'bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-medium transition-colors';
        } else {
            archiveBtn.textContent = 'Archive';
            archiveBtn.className = 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 px-6 py-2 rounded-lg font-medium transition-colors';
        }

        // Render Analytics
        if (analytics.volatility) {
            document.getElementById('volatilityLabel').textContent = analytics.volatility.label;
            document.getElementById('volatilityScore').textContent = analytics.volatility.score;
            document.getElementById('volatilityBar').style.width = `${analytics.volatility.score * 10}%`;
        }

        if (analytics.bestDay) {
            document.getElementById('bestDayLabel').textContent = analytics.bestDay.dayName;
            document.getElementById('bestDayPrice').textContent = formatPrice(analytics.bestDay.averagePrice);
        } else {
            document.getElementById('bestDayLabel').textContent = 'N/A';
            document.getElementById('bestDayPrice').textContent = '-';
        }

        if (analytics.forecast) {
            const trendEl = document.getElementById('forecastTrend');
            trendEl.textContent = analytics.forecast.trend === 'UP' ? '📈 Rising' : analytics.forecast.trend === 'DOWN' ? '📉 Falling' : '➡️ Stable';
            trendEl.className = `text-sm font-medium ${analytics.forecast.trend === 'DOWN' ? 'text-green-600' : analytics.forecast.trend === 'UP' ? 'text-red-600' : 'text-gray-600'}`;
            document.getElementById('forecastConfidence').textContent = `Conf: ${(analytics.forecast.confidence * 100).toFixed(0)}%`;
        }

        // Render Stock History
        const stockBar = document.getElementById('stockHistoryBar');
        if (analytics.stockHistory && analytics.stockHistory.length > 0) {
            stockBar.innerHTML = '';
            // Simple visualization: assume history covers last 30 days or so
            // We'll just show segments based on time duration
            // This is a bit complex to do perfectly without start/end times for every segment
            // For now, let's just show the last 10 status changes as equal blocks or something simple
            // Better: Use the dates to calculate width percentages relative to "now"

            const now = new Date().getTime();
            const firstDate = new Date(analytics.stockHistory[0].date).getTime();
            const totalDuration = now - firstDate;

            if (totalDuration > 0) {
                let lastTime = firstDate;
                let lastStatus = analytics.stockHistory[0].status;

                // Iterate through history to build segments
                // We need to handle the time *between* events
                // Event 1 (In Stock) at T1 -> Event 2 (Out of Stock) at T2
                // Segment T1-T2 was "In Stock" (assuming status persists until change)

                // Add current time as final point
                const events = [...analytics.stockHistory, { date: new Date(), status: 'now' }];

                for (let i = 0; i < events.length - 1; i++) {
                    const currentEvent = events[i];
                    const nextEvent = events[i + 1];
                    const duration = new Date(nextEvent.date).getTime() - new Date(currentEvent.date).getTime();
                    const percent = (duration / totalDuration) * 100;

                    if (percent < 0.5) continue; // Skip tiny segments

                    const colorClass = currentEvent.status === 'in_stock' ? 'bg-green-500' : 'bg-red-500';
                    const segment = document.createElement('div');
                    segment.className = `${colorClass} h-full`;
                    segment.style.width = `${percent}%`;
                    segment.title = `${currentEvent.status === 'in_stock' ? 'In Stock' : 'Out of Stock'} (${new Date(currentEvent.date).toLocaleDateString()})`;
                    stockBar.appendChild(segment);
                }
            } else {
                stockBar.innerHTML = `<div class="w-full h-full ${analytics.stockHistory[0].status === 'in_stock' ? 'bg-green-500' : 'bg-red-500'}"></div>`;
            }
        } else {
            stockBar.innerHTML = '<div class="w-full h-full flex items-center justify-center text-xs text-gray-500">No stock history available</div>';
        }

        const labels = data.history.map(h => new Date(h.date).toLocaleDateString());
        const prices = data.history.map(h => h.price);

        // Prepare forecast data for chart
        const forecastPoints = analytics.forecast ? analytics.forecast.forecast.map(f => f.price) : [];
        // Add forecast labels
        if (analytics.forecast && analytics.forecast.forecast.length > 0) {
            analytics.forecast.forecast.forEach(f => {
                labels.push(new Date(f.date).toLocaleDateString());
            });
        }

        updatePriceChart(labels, prices, forecastPoints);
    },

    toggleLogs() {
        const content = document.getElementById('logsContent');
        const arrow = document.getElementById('logsArrow');

        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            arrow.classList.add('rotate-180');
            return true; // Should fetch logs
        } else {
            content.classList.add('hidden');
            arrow.classList.remove('rotate-180');
            return false;
        }
    },

    openAddProductModal() {
        const modal = document.getElementById('addProductModal');
        const content = document.getElementById('addProductModalContent');
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        setTimeout(() => {
            content.classList.remove('scale-95', 'opacity-0');
            content.classList.add('scale-100', 'opacity-100');
        }, 10);
    },

    closeAddProductModal() {
        const modal = document.getElementById('addProductModal');
        const content = document.getElementById('addProductModalContent');
        content.classList.remove('scale-100', 'opacity-100');
        content.classList.add('scale-95', 'opacity-0');
        setTimeout(() => {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
            document.getElementById('newProductUrl').value = '';
        }, 200);
    }
};
