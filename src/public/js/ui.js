import { STATE } from './config.js';
import { formatPrice, shareDeal } from './utils.js';
import { API } from './api.js';
import { updatePriceChart } from './charts.js';
// import { fetchDeals } from './app.js'; // Removed to fix circular dependency

export const UI = {
    renderStats(data) {
        document.getElementById('totalProducts').textContent = data.totalProducts;
        document.getElementById('totalUsers').textContent = data.totalUsers;
        document.getElementById('totalTracked').textContent = data.totalTrackedItems;
    },

    renderDeals(deals, container, append = false) {
        const html = deals.map(deal => {
            if (STATE.currentView === 'list') {
                return `
                <div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition cursor-pointer group border-b border-gray-100 dark:border-gray-700" onclick="window.loadHistory('${deal.product.asin}')">
                    <div class="flex items-start space-x-4">
                        <div class="flex-shrink-0 w-16 h-16 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg overflow-hidden flex items-center justify-center p-1">
                            ${deal.product.imageUrl ? `<img src="${deal.product.imageUrl}" class="w-full h-full object-contain">` : '<span class="text-2xl">📦</span>'}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <p class="text-sm font-medium text-gray-900 dark:text-white truncate pr-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">${deal.product.name}</p>
                                <div class="flex items-center space-x-2">
                                <a href="https://t.me/TrackzoonBot?start=asin_${deal.product.asin}" target="_blank" class="text-blue-400 hover:text-blue-600 transition" title="Open in Telegram">
                                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.446 1.394c-.16.16-.295.295-.605.295l.213-3.054 5.56-5.022c.242-.213-.054-.333-.373-.121l-6.869 4.326-2.96-.924c-.64-.203-.658-.64.135-.954l11.566-4.458c.538-.196 1.006.128.832.944z"/></svg>
                                </a>
                                <button onclick="event.stopPropagation(); window.shareDeal('${deal.product.name.replace(/'/g, "\\'")}', '${deal.product.url}', ${deal.currentPrice})" class="text-gray-400 hover:text-blue-500 transition">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                </button>
                                <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                    -${deal.percentChange.toFixed(0)}%
                                </span>
                            </div>
                            </div>
                            <div class="mt-1 flex items-baseline">
                                <p class="text-lg font-bold text-gray-900 dark:text-white">${formatPrice(deal.currentPrice)}</p>
                                <p class="ml-2 text-xs text-gray-400 line-through">${formatPrice(deal.oldPrice)}</p>
                            </div>
                            <div class="mt-1 flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                                ${(() => {
                        const insights = [];

                        // 1. Deal Score Insight
                        if (deal.dealScore >= 8) insights.push(`<span class="flex items-center text-yellow-600 dark:text-yellow-400 font-bold">⭐ Top Pick (${deal.dealScore}/10)</span>`);

                        // 2. Price History Insight
                        if (deal.statsAll && deal.currentPrice <= deal.statsAll.min) {
                            insights.push(`<span class="flex items-center text-purple-600 dark:text-purple-400 font-bold bg-purple-100 dark:bg-purple-900/50 px-1.5 rounded">🏆 All-Time Low</span>`);
                        } else if (deal.stats30d && deal.currentPrice <= deal.stats30d.min) {
                            insights.push(`<span class="flex items-center text-blue-600 dark:text-blue-400 font-bold bg-blue-100 dark:bg-blue-900/50 px-1.5 rounded">📉 Lowest in 30d</span>`);
                        } else if (deal.stats30d && deal.currentPrice < deal.stats30d.average * 0.9) {
                            const diff = Math.round((1 - (deal.currentPrice / deal.stats30d.average)) * 100);
                            insights.push(`<span class="flex items-center text-green-600 dark:text-green-400 font-bold bg-green-100 dark:bg-green-900/50 px-1.5 rounded">🔥 ${diff}% Below Avg</span>`);
                        }

                        // 3. Trend Insight
                        if (deal.trend && deal.trend.trend === 'DOWN') {
                            insights.push(`<span class="text-green-600 dark:text-green-400">📉 Dropping Fast</span>`);
                        }

                        // Default if no specific insights
                        if (insights.length === 0) {
                            insights.push(`<span class="text-gray-500">👀 Good Price</span>`);
                        }

                        return insights.join('<span class="mx-1 text-gray-300">•</span>');
                    })()}
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                // Grid View
                return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition cursor-pointer flex flex-col h-full" onclick="window.loadHistory('${deal.product.asin}')">
                    <div class="flex justify-between items-start mb-2">
                        <span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                            -${deal.percentChange.toFixed(0)}%
                        </span>
                        <button onclick="event.stopPropagation(); window.shareDeal('${deal.product.name.replace(/'/g, "\\'")}', '${deal.product.url}', ${deal.currentPrice})" class="text-gray-400 hover:text-blue-500 transition">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                        </button>
                    </div>
                    <div class="flex-1 flex flex-col items-center text-center mb-2">
                        <div class="w-24 h-24 bg-white dark:bg-gray-600 rounded-lg overflow-hidden flex items-center justify-center p-1 mb-2">
                            ${deal.product.imageUrl ? `<img src="${deal.product.imageUrl}" class="w-full h-full object-contain">` : '<span class="text-4xl">📦</span>'}
                        </div>
                        <p class="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 hover:text-blue-600 dark:hover:text-blue-400 transition">${deal.product.name}</p>
                    </div>
                    <div class="mt-auto">
                        <div class="flex justify-between items-baseline mb-1">
                            <p class="text-lg font-bold text-gray-900 dark:text-white">${formatPrice(deal.currentPrice)}</p>
                            <p class="text-xs text-gray-400 line-through">${formatPrice(deal.oldPrice)}</p>
                        </div>
                        <div class="flex justify-between items-center text-xs">
                            ${deal.dealScore ? `
                                <div class="flex items-center space-x-2 w-full mr-2">
                                    <span class="text-yellow-600 dark:text-yellow-400 font-medium whitespace-nowrap">★ ${deal.dealScore}</span>
                                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                        <div class="bg-yellow-400 h-1.5 rounded-full" style="width: ${(deal.dealScore / 10) * 100}%"></div>
                                    </div>
                                </div>
                            ` : '<span></span>'}
                            ${(() => {
                        if (deal.stats30d && deal.currentPrice <= deal.stats30d.min * 1.02) {
                            return `<span class="text-green-600 font-bold whitespace-nowrap">BUY</span>`;
                        } else {
                            return `<span class="text-gray-400 whitespace-nowrap">WATCH</span>`;
                        }
                    })()}
                        </div>
                    </div>
                </div>`;
            }
        }).join('');

        if (append) {
            container.insertAdjacentHTML('beforeend', html);
        } else {
            container.innerHTML = html;
        }
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
