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
if (data && data.price > 0) {
    console.log('Trackzoon: Sending data...', data);
    // Send to Background Script
    chrome.runtime.sendMessage({ action: 'syncProduct', data: data }, (response) => {
        console.log('Trackzoon: Sync response:', response);
    });
}
