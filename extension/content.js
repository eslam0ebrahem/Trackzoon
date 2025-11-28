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

    // 5. Check Stock
    const availabilityEl = document.getElementById('availability');
    const availabilityText = availabilityEl ? availabilityEl.innerText.toLowerCase() : '';
    const isOutOfStock = availabilityText.includes('currently unavailable') ||
        availabilityText.includes('out of stock');

    return {
        asin,
        url,
        name,
        price,
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
