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
        const html = deals.map(deal => {
            if (STATE.currentView === 'list') {
                return `
                <div class="group relative bg-white dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 hover:shadow-lg hover:border-blue-100 dark:hover:border-blue-900 transition-all duration-300 cursor-pointer" onclick="window.loadHistory('${deal.product.asin}')">
                    <div class="flex items-start space-x-5">
                        <!-- Image Container -->
                        <div class="flex-shrink-0 w-20 h-20 bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden flex items-center justify-center p-2 group-hover:scale-105 transition-transform duration-300">
                            ${deal.product.imageUrl ? `<img src="${deal.product.imageUrl}" class="w-full h-full object-contain mix-blend-multiply dark:mix-blend-normal">` : '<span class="text-3xl">📦</span>'}
                        </div>
                        
                        <!-- Content -->
                        <div class="flex-1 min-w-0">
                            <div class="flex justify-between items-start">
                                <div class="pr-4">
                                    <h3 class="text-base font-semibold text-gray-900 dark:text-white leading-tight mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                                        ${deal.product.name}
                                    </h3>
                                    <div class="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                                        <span>ASIN: ${deal.product.asin}</span>
                                        <span>•</span>
                                        <span>${new Date(deal.product.lastChecked).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                
                                <!-- Actions & Badge -->
                                <div class="flex flex-col items-end space-y-2">
                                    ${(() => {
                        const isDrop = deal.percentChange > 0;
                        const isIncrease = deal.percentChange < 0;
                        const colorClass = isDrop
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800'
                            : (isIncrease
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600');
                        const arrow = isDrop ? '↓' : (isIncrease ? '↑' : '-');

                        return `<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}">
                                            ${arrow} ${Math.abs(deal.percentChange).toFixed(0)}%
                                        </span>`;
                    })()}
                                    
                                    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href="${deal.product.url}" target="_blank" onclick="event.stopPropagation()" class="p-1.5 text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-full transition-colors" title="View on Amazon">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                        </a>
                                        <button onclick="event.stopPropagation(); window.shareDeal('${deal.product.name.replace(/'/g, "\\'")}', '${deal.product.url}', ${deal.currentPrice})" class="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full transition-colors" title="Share">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"></path></svg>
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Price & Insights -->
                            <div class="flex items-end justify-between mt-1">
                                <div>
                                    <div class="flex items-baseline space-x-2">
                                        <span class="text-xl font-bold text-gray-900 dark:text-white tracking-tight">${formatPrice(deal.currentPrice)}</span>
                                        <span class="text-sm text-gray-400 line-through decoration-gray-300 dark:decoration-gray-600">${formatPrice(deal.oldPrice)}</span>
                                    </div>
                                    
                                    <!-- Smart Insights Pills -->
                                    <div class="flex flex-wrap gap-2 mt-2">
                                        ${(() => {
                        const insights = [];

                        // Deal Score
                        if (deal.dealScore >= 80) {
                            insights.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800">
                                                    🔥 Hot Deal (${deal.dealScore})
                                                </span>`);
                        }

                        // Price History
                        if (deal.statsAll && deal.currentPrice <= deal.statsAll.min) {
                            insights.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                                                    🏆 All-Time Low
                                                </span>`);
                        } else if (deal.stats30d && deal.currentPrice <= deal.stats30d.min) {
                            insights.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                                    📉 Lowest (30d)
                                                </span>`);
                        }

                        // Volatility/Trend - Only show "Stable" if price didn't just increase
                        if (deal.stats30d && deal.stats30d.volatility < 3 && deal.percentChange >= 0) {
                            insights.push(`<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-100 dark:border-green-800">
                                                    🛡️ Stable Price
                                                </span>`);
                        }

                        return insights.length > 0 ? insights.join('') : `<span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">👀 Good Price</span>`;
                    })()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>`;
            } else {
                // Grid View
                return `
                <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-4 hover:shadow-md transition cursor-pointer flex flex-col h-full" onclick="window.loadHistory('${deal.product.asin}')">
                    <div class="flex justify-between items-start mb-2">
                        ${(() => {
                        const isDrop = deal.percentChange > 0;
                        const isIncrease = deal.percentChange < 0;
                        const colorClass = isDrop
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-100 dark:border-green-800'
                            : (isIncrease
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-100 dark:border-red-800'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600');
                        const arrow = isDrop ? '↓' : (isIncrease ? '↑' : '-');

                        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold border ${colorClass}">
                                ${arrow} ${Math.abs(deal.percentChange).toFixed(0)}%
                            </span>`;
                    })()}
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
