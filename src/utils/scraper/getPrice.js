import * as cheerio from 'cheerio';
import axios from 'axios';
import { logger } from '../logger.js';

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15'
];

const getRandomUserAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function fetchPage(url) {
  const headers = {
    'User-Agent': getRandomUserAgent(),
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  try {
    const response = await axios.get(url, {
      headers,
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: status => status === 200 || status === 404 // Handle 404 gracefully
    });
    return response;
  } catch (error) {
    throw new Error(`Network error: ${error.message}`);
  }
}

function checkAvailability($) {
  const availabilitySelectors = [
    '#availability span',
    '#availability',
    '.availability span',
    '[data-feature-name="availability"]'
  ];

  let availabilityText = '';
  for (const selector of availabilitySelectors) {
    const element = $(selector).first();
    if (element.length) {
      availabilityText = element.text().trim().toLowerCase();
      if (availabilityText) break;
    }
  }

  const outOfStockPatterns = [
    /\bcurrently unavailable\b/,
    /\btemporarily unavailable\b/,
    /\bout of stock\b/,
    /\btemporarily out of stock\b/,
    /\bnot available\b/,
    /\bunavailable\b(?!.*\bavailable\b)/
  ];

  const isOutOfStock = outOfStockPatterns.some(pattern => pattern.test(availabilityText));

  if (isOutOfStock) {
    logger.info(`Product detected as out of stock. Text: "${availabilityText}"`);
    return { isOutOfStock: true, text: availabilityText };
  }

  return { isOutOfStock: false, text: availabilityText };
}

function extractPrice($) {
  const selectors = [
    '#corePriceDisplay_desktop_feature_div .a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePrice_desktop .a-price .a-offscreen',
    '.priceToPay .a-offscreen',
    'span.priceToPay .a-offscreen',
    '.a-price.priceToPay .a-offscreen',
    '#price_inside_buybox',
    '.a-section.a-spacing-none.aok-align-center #price_inside_buybox',
    '#priceblock_dealprice',
    '#priceblock_ourprice',
    '#priceblock_saleprice',
    '#apex_desktop .a-price .a-offscreen',
    '#apex_desktop .apexPriceToPay .a-offscreen',
    '.apex_offerDisplay_desktop .a-price .a-offscreen',
    '.a-box-inner .a-price .a-offscreen',
    '#buybox .a-price .a-offscreen',
    '#centerCol .a-price .a-offscreen',
    '#rightCol .a-price .a-offscreen',
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      // Avoid related products
      const isInSimilarProducts = element.closest('#similarities_feature_div, #sims-fbt, #sp_detail, [data-feature-name="aplus"]').length > 0;
      if (!isInSimilarProducts) {
        return { priceText: element.text().trim(), selector };
      }
    }
  }
  return null;
}

function parsePrice(priceText) {
  if (!priceText) return null;

  // Remove currency symbols and cleanup
  const cleanText = priceText.replace(/EGP|£|€|\$|[^\d.,]/gi, '').trim();

  let price;
  if (cleanText.includes(',') && cleanText.includes('.')) {
    price = parseFloat(cleanText.replace(/,/g, ''));
  } else if (cleanText.includes(',')) {
    price = parseFloat(cleanText.replace(',', '.'));
  } else {
    price = parseFloat(cleanText);
  }

  return (!isNaN(price) && price > 0) ? price : null;
}

async function getPrice(url) {
  try {
    const response = await fetchPage(url);

    if (response.status === 404) {
      throw new Error('Product page not found (404)');
    }

    const html = response.data;
    const $ = cheerio.load(html);

    // Check for captcha
    if ($('title').text().includes('Robot Check')) {
      throw new Error('Amazon Captcha detected');
    }

    const { isOutOfStock, text: availabilityText } = checkAvailability($);
    if (isOutOfStock) {
      throw new Error('Product is currently out of stock or unavailable');
    }

    const priceResult = extractPrice($);
    if (!priceResult) {
      // Fallback: check if we can find any price-like text in buy box
      const buyBoxText = $('#buybox, #centerCol').text();
      const priceMatch = buyBoxText.match(/[£$€]\s*(\d{1,5}(?:[.,]\d{2})?)/);
      if (priceMatch) {
        const price = parsePrice(priceMatch[1]);
        if (price) {
          logger.info(`Found price via fallback regex: ${price}`);
          return price;
        }
      }

      logger.warn(`Price not found. Availability: ${availabilityText}`);
      throw new Error('Price not found - page structure may have changed');
    }

    const price = parsePrice(priceResult.priceText);
    if (!price) {
      throw new Error(`Invalid price format: ${priceResult.priceText}`);
    }

    logger.info(`Successfully extracted price: ${price} (selector: ${priceResult.selector})`);
    return price;

  } catch (error) {
    logger.error(`Error scraping ${url}:`, error);
    throw error;
  }
}

export { getPrice };