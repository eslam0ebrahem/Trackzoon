// content.js - Runs on Amazon Product Pages

const DEFAULT_SETTINGS = {
    autoSync: true,
    showTrackButton: true,
    syncCooldownMinutes: 30
};

let settings = { ...DEFAULT_SETTINGS };
let cachedData = null;
let lastUrl = window.location.href;
const STATUS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

function extractAsin(url) {
    const match = url.match(/\/dp\/([A-Z0-9]{10})/);
    return match ? match[1] : null;
}

function parsePrice(text) {
    if (!text) return null;
    let cleaned = text.replace(/\s/g, '').replace(/[^\d.,]/g, '');
    if (!cleaned) return null;

    const hasDot = cleaned.includes('.');
    const hasComma = cleaned.includes(',');

    if (hasDot && hasComma) {
        if (cleaned.lastIndexOf('.') > cleaned.lastIndexOf(',')) {
            cleaned = cleaned.replace(/,/g, '');
        } else {
            cleaned = cleaned.replace(/\./g, '').replace(',', '.');
        }
    } else if (hasComma && !hasDot) {
        const parts = cleaned.split(',');
        if (parts.length === 2 && parts[1].length <= 2) {
            cleaned = `${parts[0]}.${parts[1]}`;
        } else {
            cleaned = cleaned.replace(/,/g, '');
        }
    }

    const value = parseFloat(cleaned);
    return Number.isFinite(value) ? value : null;
}

function isInsideOfferListing(el) {
    if (!el) return false;
    const offerRoots = [
        '#aod-offer-list',
        '#all-offers-display',
        '#olpOfferList',
        '#olp_feature_div',
        '#offer-listing',
        '#aod-offer'
    ];
    return offerRoots.some((selector) => {
        const root = document.querySelector(selector);
        return root ? root.contains(el) : false;
    });
}

function detectAvailability() {
    const availabilityEl =
        document.getElementById('availability') ||
        document.querySelector('#availability .a-color-state') ||
        document.querySelector('#availability span');

    const availabilityText = availabilityEl ? availabilityEl.innerText.toLowerCase().trim() : '';

    const outOfStockPatterns = [
        'currently unavailable',
        'temporarily unavailable',
        'out of stock',
        'temporarily out of stock',
        'not available',
        'currently not available',
        'no longer available',
        'discontinued'
    ];

    if (outOfStockPatterns.some(p => availabilityText.includes(p))) {
        return { isOutOfStock: true, reason: 'pattern-match' };
    }

    const unqualifiedSelectors = [
        '#unqualifiedBuyBox',
        '#buybox-see-all-buying-choices',
        '#buybox-see-all-buying-choices-announce',
        'a[title="See All Buying Options"]',
        '#fod-cx-box'
    ];

    for (const sel of unqualifiedSelectors) {
        const el = document.querySelector(sel);
        if (el) {
            if (sel === '#fod-cx-box' && !el.innerText.toLowerCase().includes('no featured offers')) {
                continue;
            }
            return {
                isOutOfStock: true,
                reason: sel === '#fod-cx-box' ? 'no-featured-offers' : 'unqualified-buybox'
            };
        }
    }

    if (availabilityText.includes('available from these sellers')) {
        return { isOutOfStock: true, reason: 'third-party-only' };
    }

    return { isOutOfStock: false, reason: 'in-stock' };
}

function extractPrice(availabilityReason) {
    if (availabilityReason === 'unqualified-buybox' || availabilityReason === 'no-featured-offers') {
        return 0;
    }

    const priceSelectors = [
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#price_inside_buybox',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#priceblock_saleprice',
        '.a-price .a-offscreen'
    ];

    for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (!el || isInsideOfferListing(el)) continue;
        const value = parsePrice(el.innerText.trim());
        if (value !== null) return value;
    }

    return 0;
}

function extractRating() {
    const ratingEl = document.querySelector('#acrPopover, span[data-hook="rating-out-of-text"]');
    const ratingText = ratingEl ? ratingEl.innerText : '';
    const ratingMatch = ratingText.match(/([\d.]+)/);
    const stars = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    const countEl = document.querySelector('#acrCustomerReviewText, span[data-hook="total-review-count"]');
    const countText = countEl ? countEl.innerText : '';
    const countMatch = countText.replace(/,/g, '').match(/([\d]+)/);
    const count = countMatch ? parseInt(countMatch[1], 10) : null;

    return { stars, count };
}

function extractMerchant() {
    const merchantEl = document.getElementById('merchant-info');
    if (!merchantEl) return '';
    return merchantEl.innerText.trim().replace(/\s+/g, ' ');
}

function extractDeliveryMessage() {
    const deliveryEl = document.getElementById('deliveryMessageMirId') || document.querySelector('#mir-layout-DELIVERY_BLOCK');
    if (!deliveryEl) return '';
    return deliveryEl.innerText.trim().replace(/\s+/g, ' ');
}

function extractCoupon() {
    const couponEl = document.querySelector('[data-a-badge-color="success"], #couponText');
    if (!couponEl) return '';
    return couponEl.innerText.trim().replace(/\s+/g, ' ');
}

function scrapeProduct() {
    console.log('Trackzoon: Scraping product...');

    const url = window.location.href;
    const asin = extractAsin(url);

    if (!asin) {
        console.log('Trackzoon: No ASIN found.');
        return null;
    }

    const titleEl = document.getElementById('productTitle');
    const name = titleEl ? titleEl.innerText.trim() : 'Unknown Product';

    const imgEl = document.getElementById('landingImage');
    const imageUrl = imgEl ? imgEl.src : '';

    const availability = detectAvailability();
    const price = availability.isOutOfStock ? 0 : extractPrice(availability.reason);

    const rating = extractRating();
    const merchant = extractMerchant();
    const deliveryMessage = extractDeliveryMessage();
    const coupon = extractCoupon();
    const prime = Boolean(document.querySelector('i.a-icon-prime, #primeBadge, .prime-badge'));

    console.log(`Trackzoon: Stock Check -> OutOfStock: ${availability.isOutOfStock} (${availability.reason})`);

    return {
        asin,
        url,
        name,
        price,
        imageUrl,
        isOutOfStock: availability.isOutOfStock,
        availabilityReason: availability.reason,
        rating: rating.stars,
        ratingCount: rating.count,
        merchant,
        prime,
        deliveryMessage,
        coupon
    };
}

function injectTrackButton(data) {
    if (!settings.showTrackButton) return;
    if (document.getElementById('trackzoon-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'trackzoon-btn';
    btn.innerText = '➕ Track with Trackzoon';
    btn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 12px 20px;
        background-color: #007185;
        color: white;
        border: none;
        border-radius: 25px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        font-family: sans-serif;
        font-size: 14px;
        transition: transform 0.2s;
    `;

    btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
    btn.onmouseout = () => btn.style.transform = 'scale(1)';

    btn.onclick = () => {
        btn.innerText = '⏳ Adding...';
        btn.disabled = true;

        const payload = { ...data, create: true };
        chrome.runtime.sendMessage({ action: 'syncProduct', data: payload }, async (response) => {
            console.log('Trackzoon: Create response:', response);
            if (response && response.result && response.result.status === 'created') {
                await storeLastSync(data.asin, response.result);
                btn.innerText = '✅ Tracking';
                btn.style.backgroundColor = '#4CAF50';
                setTimeout(() => btn.remove(), 3000);
            } else {
                btn.innerText = '❌ Error';
                btn.style.backgroundColor = '#f44336';
                setTimeout(() => {
                    btn.innerText = '➕ Track with Trackzoon';
                    btn.disabled = false;
                    btn.style.backgroundColor = '#007185';
                }, 2000);
            }
        });
    };

    document.body.appendChild(btn);
}

function showNotification(message, color = '#4CAF50') {
    const div = document.createElement('div');
    div.innerText = message;
    div.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        z-index: 9999;
        padding: 10px 20px;
        background-color: ${color};
        color: white;
        border-radius: 5px;
        font-family: sans-serif;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3000);
}

async function storeLastSync(asin, result) {
    if (!asin) return;
    const stored = await chrome.storage.local.get(['lastSyncByAsin']);
    const lastSyncByAsin = stored.lastSyncByAsin || {};
    lastSyncByAsin[asin] = {
        timestamp: Date.now(),
        status: result.status,
        smartScore: result.product ? result.product.smartScore : undefined
    };
    await chrome.storage.local.set({ lastSyncByAsin });

    if (result.status === 'updated' || result.status === 'created') {
        await storeTrackingStatus(asin, true);
    } else if (result.status === 'new_product') {
        await storeTrackingStatus(asin, false);
    }
}

async function shouldAutoSync(asin) {
    if (!settings.autoSync) return false;
    const cooldown = Math.max(1, Number(settings.syncCooldownMinutes) || DEFAULT_SETTINGS.syncCooldownMinutes);
    const stored = await chrome.storage.local.get(['lastSyncByAsin']);
    const last = stored.lastSyncByAsin ? stored.lastSyncByAsin[asin] : null;
    if (!last || !last.timestamp) return true;
    const elapsedMinutes = (Date.now() - last.timestamp) / (60 * 1000);
    return elapsedMinutes >= cooldown;
}

async function maybeAutoSync(data) {
    if (!data || !data.asin) return;
    if (data.price <= 0) {
        injectTrackButton(data);
        return;
    }
    if (!(await shouldAutoSync(data.asin))) {
        console.log('Trackzoon: Auto-sync skipped (cooldown).');
        return;
    }

    chrome.runtime.sendMessage({ action: 'syncProduct', data }, async (response) => {
        console.log('Trackzoon: Sync response:', JSON.stringify(response, null, 2));
        if (!response || response.status === 'error') {
            return;
        }
        if (response.result) {
            const res = response.result;
            await storeLastSync(data.asin, res);
            if (res.status === 'updated') {
                showNotification('Trackzoon: Price Updated ✅');
                const btn = document.getElementById('trackzoon-btn');
                if (btn) btn.remove();
            } else if (res.status === 'new_product') {
                injectTrackButton(data);
            } else if (res.status === 'created') {
                const btn = document.getElementById('trackzoon-btn');
                if (btn) btn.remove();
            }
        }
    });
}

async function getTrackingStatusFromCache(asin) {
    const stored = await chrome.storage.local.get(['trackingStatusByAsin']);
    const entry = stored.trackingStatusByAsin ? stored.trackingStatusByAsin[asin] : null;
    if (!entry) return null;
    if (!entry.timestamp || (Date.now() - entry.timestamp) > STATUS_CACHE_TTL_MS) return null;
    return entry.tracked;
}

async function storeTrackingStatus(asin, tracked) {
    if (!asin) return;
    const stored = await chrome.storage.local.get(['trackingStatusByAsin']);
    const trackingStatusByAsin = stored.trackingStatusByAsin || {};
    trackingStatusByAsin[asin] = {
        tracked: Boolean(tracked),
        timestamp: Date.now()
    };
    await chrome.storage.local.set({ trackingStatusByAsin });
}

async function checkTrackingStatus(asin) {
    if (!asin) return null;

    const storedSync = await chrome.storage.local.get(['lastSyncByAsin']);
    const lastSync = storedSync.lastSyncByAsin ? storedSync.lastSyncByAsin[asin] : null;
    if (lastSync && (lastSync.status === 'updated' || lastSync.status === 'created')) {
        return true;
    }
    if (lastSync && lastSync.status === 'new_product') {
        return false;
    }

    const cached = await getTrackingStatusFromCache(asin);
    if (cached !== null) return cached;

    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'checkStatus', asin }, async (response) => {
            if (!response || response.status === 'error' || !response.result) {
                resolve(null);
                return;
            }
            const tracked = response.result.tracked === true;
            await storeTrackingStatus(asin, tracked);
            resolve(tracked);
        });
    });
}

async function refreshTrackingState(data) {
    const tracked = await checkTrackingStatus(data.asin);
    if (tracked === true) {
        const btn = document.getElementById('trackzoon-btn');
        if (btn) btn.remove();
        return;
    }

    if (tracked === false) {
        injectTrackButton(data);
        return;
    }

    // Unknown status: avoid showing the button to prevent false positives
}

function runForCurrentPage() {
    cachedData = scrapeProduct();
    if (!cachedData) return;
    refreshTrackingState(cachedData);
    maybeAutoSync(cachedData);
}

function applySettings(newSettings) {
    settings = { ...settings, ...newSettings };
    const btn = document.getElementById('trackzoon-btn');
    if (!settings.showTrackButton && btn) {
        btn.remove();
    }
}

chrome.storage.sync.get(Object.keys(DEFAULT_SETTINGS), (stored) => {
    applySettings(stored);
    runForCurrentPage();
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const update = {};
    for (const [key, change] of Object.entries(changes)) {
        update[key] = change.newValue;
    }
    applySettings(update);
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getProductData') {
        const data = scrapeProduct();
        sendResponse({ data });
        return true;
    }
});

setInterval(() => {
    if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(runForCurrentPage, 1200);
    }
}, 1000);
