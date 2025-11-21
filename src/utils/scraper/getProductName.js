import * as cheerio from 'cheerio';
import axios from 'axios';
import cache, { CacheKeys, CacheTTL } from '../../config/cache.js';

async function getProductName(url) {
  // Extract ASIN from URL for caching
  const asinMatch = url.match(/\/([A-Z0-9]{10})(?:\/|\?|$)/i);
  const asin = asinMatch ? asinMatch[1] : null;

  // Try cache first
  if (asin) {
    const cached = await cache.get(CacheKeys.productName(asin));
    if (cached) {
      console.log(`Cache hit: Product name for ${asin}`);
      return cached;
    }
  }

  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
  const response = await axios.get(url, { headers }); // Use axios.get
  const html = response.data; // Axios puts data in .data
  const $ = cheerio.load(html);

  // Most Amazon product pages use this selector for the product title
  const name = $('#productTitle').text().trim() || $('span#productTitle').text().trim();
  const result = name || 'Unknown Product';

  // Cache the result
  if (asin && result !== 'Unknown Product') {
    await cache.set(CacheKeys.productName(asin), result, CacheTTL.PRODUCT_NAME);
  }

  return result;
}

export { getProductName };