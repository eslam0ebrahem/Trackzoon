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
    /\bunavailable\b(?!.*\bavailable\b)/,
    /\bcurrently not available\b/,
    /\bno longer available\b/,
    /\bdiscontinued\b/
  ];

  const isOutOfStock = outOfStockPatterns.some(pattern => pattern.test(availabilityText));

  if (isOutOfStock) {
    logger.info(`Product detected as out of stock. Text: "${availabilityText}"`);
    return { isOutOfStock: true, text: availabilityText };
  }

  // Additional check: if availability section exists but is empty or has suspicious text,
  // and we can't find a buybox, it might be unavailable
  const hasBuyBox = $('#buybox, #buy-now-button, #add-to-cart-button').length > 0;
  if (!hasBuyBox && availabilityText) {
    logger.warn(`No buy box found and availability text is: "${availabilityText}"`);
    // This could indicate the product is not available for purchase
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

  // Expanded list of sections to exclude (related products, similar items, etc.)
  const excludedSections = [
    '#similarities_feature_div',        // Similar items
    '#sims-fbt',                        // Frequently bought together
    '#sp_detail',                       // Sponsored products
    '[data-feature-name="aplus"]',      // A+ content
    '#HLCXComparisonWidget',            // Comparison widget
    '#comparison_table',                // Comparison table
    '#btfContent2',                     // Below the fold content
    '#rhf',                             // Related to this item
    '#anonCarousel1',                   // Carousels often have related products
    '#anonCarousel2',
    '#anonCarousel3',
    '[cel_widget_id*="desktop-similar"]',  // Similar products widget
    '[cel_widget_id*="MAIN-SIMILAR"]',
    '.similarities-widget',
    '.a-carousel-container',            // Generic carousel
    '#sponsoredProducts',               // Sponsored products section
    '#session-recommendations',         // Recommendations
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      // Check if element is within any excluded sections
      const isInExcludedSection = excludedSections.some(excludedSelector => {
        return element.closest(excludedSelector).length > 0;
      });

      if (!isInExcludedSection) {
        // Found a valid price - log and return it
        logger.info(`Found price with selector: ${selector}`);
        return { priceText: element.text().trim(), selector };
      } else {
        logger.warn(`Skipping price from selector ${selector} - in excluded section`);
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

    // Check if product is only available from third-party sellers
    const pageText = $('body').text().toLowerCase();
    const thirdPartyOnlyPatterns = [
      /only available from third-party sellers/i,
      /this item is only available from third-party sellers/i,
      /only available through.*third-party/i
    ];

    const isThirdPartyOnly = thirdPartyOnlyPatterns.some(pattern => pattern.test(pageText));
    if (isThirdPartyOnly) {
      logger.info('Product is only available from third-party sellers - treating as unavailable');
      throw new Error('Product is only available from third-party sellers');
    }

    // Check for "Currently unavailable" in variant/size selections
    const variantText = $('#variation_size_name, #native_dropdown_selected_size_name, .a-button-selected').text().toLowerCase();
    if (variantText.includes('currently unavailable')) {
      logger.info('Selected variant is currently unavailable');
      throw new Error('Selected product variant is currently unavailable');
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

    // Extract image URL
    let imageUrl = $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      $('.a-dynamic-image').first().attr('src');

    return { price, imageUrl };

  } catch (error) {
    logger.error(`Error scraping ${url}:`, error);
    throw error;
  }
}

export { getPrice };