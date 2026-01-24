// content.js - Runs on Amazon Product Pages

function scrapeProduct() {
    console.log('Trackzoon: Scraping product...');

    // 1. Extract ASIN
    const url = window.location.href;
    const asinMatch = url.match(/\/dp\/([A-Z0-9]{10})/);
    const asin = asinMatch ? asinMatch[1] : null;

    if (!asin) {
        console.log('Trackzoon: No ASIN found.');
        return null;
    }

    // 2. Extract Price
    let price = 0;
    const priceSelectors = [
        '#corePrice_feature_div .a-price .a-offscreen',
        '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
        '#price_inside_buybox',
        '#priceblock_ourprice',
        '.a-price .a-offscreen'
    ];

    for (const selector of priceSelectors) {
        const el = document.querySelector(selector);
        if (el) {
            const text = el.innerText.trim();
            const clean = text.replace(/[^\d.]/g, '');
            if (clean) {
                price = parseFloat(clean);
                break;
            }
        }
    }

    // 3. Extract Title
    const titleEl = document.getElementById('productTitle');
    const name = titleEl ? titleEl.innerText.trim() : 'Unknown Product';

    // 4. Extract Image
    const imgEl = document.getElementById('landingImage');
    const imageUrl = imgEl ? imgEl.src : '';

    // 5. Check Stock (Smart Availability Check)
    let isOutOfStock = false;
    let availabilityReason = 'unknown';

    const availabilityEl = document.getElementById('availability') || document.querySelector('#availability .a-color-state');
    const availabilityText = availabilityEl ? availabilityEl.innerText.toLowerCase().trim() : '';

    // Strategy 1: Explicit "Out of Stock" patterns
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
        isOutOfStock = true;
        availabilityReason = 'pattern-match';
    }

    // Strategy 2: "Unqualified Buy Box" (e.g., "See All Buying Options")
    // This usually means no main seller, so we treat it as out of stock/unavailable for tracking
    if (!isOutOfStock) {
        const unqualifiedSelectors = [
            '#unqualifiedBuyBox',
            '#buybox-see-all-buying-choices',
            '#buybox-see-all-buying-choices-announce',
            'a[title="See All Buying Options"]',
            '#fod-cx-box' // "No featured offers available"
        ];

        for (const sel of unqualifiedSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                // Double check for "No featured offers" text to be sure
                if (sel === '#fod-cx-box') {
                    if (el.innerText.toLowerCase().includes('no featured offers')) {
                        isOutOfStock = true;
                        availabilityReason = 'no-featured-offers';
                        break;
                    }
                } else {
                    isOutOfStock = true;
                    availabilityReason = 'unqualified-buybox';
                    break;
                }
            }
        }
    }

    // Strategy 3: Third Party Seller Check
    // If it says "Available from these sellers.", it might mean no authorized seller
    if (!isOutOfStock && availabilityText.includes('available from these sellers')) {
        isOutOfStock = true; // Treated as unavailable for main price tracking
        availabilityReason = 'third-party-only';
    }

    console.log(`Trackzoon: Stock Check -> OutOfStock: ${isOutOfStock} (${availabilityReason})`);

    return {
        asin,
        url,
        name,
        price: isOutOfStock ? 0 : price, // Force price to 0 if out of stock to trigger server verification
        imageUrl,
        isOutOfStock
    };
}

// Run immediately
const data = scrapeProduct();

function injectTrackButton(data) {
    // Avoid duplicates
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
        background-color: #007185; /* Amazon Blue */
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

        // Send with create: true
        const payload = { ...data, create: true };
        chrome.runtime.sendMessage({ action: 'syncProduct', data: payload }, (response) => {
            console.log('Trackzoon: Create response:', response);
            if (response && response.result && response.result.status === 'created') {
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

if (data && data.price > 0) {
    console.log('Trackzoon: Sending data...', data);
    // Send to Background Script (default check)
    chrome.runtime.sendMessage({ action: 'syncProduct', data: data }, (response) => {
        console.log('Trackzoon: Sync response:', JSON.stringify(response, null, 2));

        if (response && response.result) {
            const res = response.result;
            if (res.status === 'updated') {
                console.log('Trackzoon: Product updated.');
                showNotification('Trackzoon: Price Updated ✅');
            } else if (res.status === 'new_product') {
                console.log('Trackzoon: New product detected.');
                injectTrackButton(data);
            }
        }
    });
}
