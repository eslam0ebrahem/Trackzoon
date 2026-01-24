import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import { logger } from '../logger.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * ========================================
 * SMART SCRAPER WITH MULTI-STRATEGY DETECTION
 * ========================================
 * 
 * Features:
 * 1. Multi-strategy price detection (try multiple methods)
 * 2. Intelligent availability detection
 * 3. Data validation layer
 * 4. Better error reporting
 */

// ============================================
// 1. SMART AVAILABILITY DETECTION
// ============================================

/**
 * Strategy 1: Check availability text
 */
function checkAvailabilityText($) {
  const selectors = [
    '#availability span',
    '#availability',
    '.availability span',
    '[data-feature-name="availability"]'
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      // Clone and remove script/style tags
      const clone = element.clone();
      clone.find('script, style, noscript').remove();
      let text = clone.text().trim().toLowerCase();

      // Skip if it looks like JavaScript code
      if (text && !text.includes('function') && !text.includes('p.when') && !text.includes('var ')) {
        return { text, source: selector };
      }
    }
  }

  return { text: '', source: 'none' };
}

/**
 * Strategy 2: Check for buy box presence
 */
function checkBuyBoxPresence($) {
  const buyBoxSelectors = [
    '#buybox',
    '#add-to-cart-button',
    '#buy-now-button',
    '#submit\\.add-to-cart',
    '#availability .a-color-success'
  ];

  for (const selector of buyBoxSelectors) {
    if ($(selector).length > 0) {
      return { hasBox: true, selector };
    }
  }

  return { hasBox: false, selector: 'none' };
}

/**
 * Strategy 3: Check for third-party seller only
 */
function checkThirdPartySeller($) {
  // Comprehensive list of selectors where third-party messages appear
  const selectors = [
    '#alternativeOfferEligibilityMessaging_feature_div',
    '#buybox-see-all-buying-choices',
    '.a-declarative[data-action="show-all-offers-display"]',
    '#merchant-info',  // Often contains seller info
    '#tabular-buybox', // New buybox design
    '#buybox',         // Main buybox area
    '#availability',   // Availability section
    '#buyBoxAccordion' // Accordion-style buybox
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      const clone = element.clone();
      clone.find('script, style').remove();
      const text = clone.text().toLowerCase();

      // Check for various third-party messages
      if (text.includes('only available from third-party sellers') ||
        text.includes('only available from third-party') ||
        text.includes('this item is only available from third-party')) {
        logger.info(`🚫 Third-party only detected: "${text.substring(0, 80).trim()}"`);
        return { isThirdParty: true, text: text.substring(0, 100) };
      }
    }
  }

  // Additional broad search in the entire product details area as a last resort
  const productDetails = $('#dp-container, #ppd').first();
  if (productDetails.length) {
    const clone = productDetails.clone();
    clone.find('script, style').remove();
    const text = clone.text().toLowerCase();

    if (text.includes('this item is only available from third-party sellers')) {
      logger.info('🚫 Third-party only detected in product details area');
      return { isThirdParty: true, text: 'Found in product details area' };
    }
  }

  return { isThirdParty: false, text: '' };
}

/**
 * MASTER: Intelligent availability check
 */
function smartAvailabilityCheck($) {
  logger.debug('🔍 Running smart availability check...');

  // Strategy 1: Check for third-party sellers FIRST
  const thirdPartyCheck = checkThirdPartySeller($);
  if (thirdPartyCheck.isThirdParty) {
    logger.debug(`✅ Third-party seller detected: "${thirdPartyCheck.text}"`);
    return {
      isAvailable: false,
      reason: 'third-party-only',
      details: thirdPartyCheck.text
    };
  }

  // Strategy 2: Check availability text
  const availText = checkAvailabilityText($);
  logger.debug(`📝 Availability text: "${availText.text}" (from ${availText.source})`);

  // Strategy 2.5: Check for "No featured offers available" (no buybox)
  // Note: #fod-cx-box can also contain "Price higher than typical" which should NOT be treated as unavailable
  const noFeaturedOffers = $('#fod-cx-box, #fodcx_feature_div').first();
  if (noFeaturedOffers.length) {
    const messageText = noFeaturedOffers.text().toLowerCase();
    // Only flag as unavailable if it's specifically about no featured offers
    const isNoFeaturedOffers = (
      messageText.includes('no featured offers available') ||
      (messageText.includes('no featured offers') && !messageText.includes('price higher'))
    );

    if (isNoFeaturedOffers) {
      logger.info('📦 No featured offers available detected (no buybox)');
      return {
        isAvailable: false,
        reason: 'no-buybox',
        details: 'No featured offers available'
      };
    } else {
      logger.debug(`ℹ️ Found #fod-cx-box but not a no-buybox scenario: "${messageText.substring(0, 50)}..."`);
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

  const isOutOfStock = outOfStockPatterns.some(pattern => pattern.test(availText.text));

  if (isOutOfStock) {
    logger.info(`❌ Out of stock detected: "${availText.text}"`);
    return {
      isAvailable: false,
      reason: 'out-of-stock',
      details: availText.text
    };
  }

  // Strategy 3: Check buy box presence
  const buyBox = checkBuyBoxPresence($);
  logger.debug(`📦 Buy box present: ${buyBox.hasBox} (selector: ${buyBox.selector})`);

  // NEW: Check for "unqualified" buy box (e.g. "See All Buying Options" but no Add to Cart)
  // This usually means the item is out of stock from the main seller or only available via third parties
  const unqualifiedSelectors = [
    '#unqualifiedBuyBox',
    '#buybox-see-all-buying-choices',
    '#buybox-see-all-buying-choices-announce',
    'a[title="See All Buying Options"]'
  ];

  const hasUnqualifiedBuyBox = unqualifiedSelectors.some(sel => $(sel).length > 0);
  if (hasUnqualifiedBuyBox) {
    logger.debug('❌ Unqualified Buy Box detected (See All Buying Options)');
    // If we have an unqualified buy box, treat as unavailable essentially, 
    // unless we want to track third party prices (which checkThirdPartySeller checks for).
    // But since checkThirdPartySeller didn't trigger above (it's the first check), 
    // we can assume we want to mark this as unavailable to avoid grabbing random prices.
    return {
      isAvailable: false,
      reason: 'no-featured-offers',
      details: 'Unqualified Buy Box present'
    };
  }

  // If no availability text but no buy box, might be unavailable
  if (!availText.text && !buyBox.hasBox) {
    logger.warn('⚠️ No availability text AND no buy box - treating as unavailable');
    return {
      isAvailable: false,
      reason: 'no-buy-box',
      details: 'No buy box or availability information found'
    };
  }

  // Strategy 4: Check for variant unavailability
  const variantText = $('#variation_size_name, #native_dropdown_selected_size_name, .a-button-selected').text().toLowerCase();
  if (variantText.includes('currently unavailable')) {
    logger.info('❌ Variant unavailable');
    return {
      isAvailable: false,
      reason: 'variant-unavailable',
      details: variantText
    };
  }

  // All checks passed - product is available
  logger.debug('✅ Product is available');
  return {
    isAvailable: true,
    reason: 'in-stock',
    details: availText.text || 'Available'
  };
}

// ============================================
// 2. MULTI-STRATEGY PRICE DETECTION
// ============================================

/**
 * Strategy 1: Standard price selectors
 */
function extractPriceFromSelectors($) {
  const excludedSections = [
    '#similarities_feature_div',
    '#sims-fbt',
    '#sp_detail',
    '[data-feature-name="aplus"]',
    '#HLCXComparisonWidget',
    '#comparison_table',
    '#btfContent2',
    '#rhf',
    '#anonCarousel1',
    '#anonCarousel2',
    '#anonCarousel3',
    '[cel_widget_id*="desktop-similar"]',
    '[cel_widget_id*="MAIN-SIMILAR"]',
    '.similarities-widget',
    '.a-carousel-container',
    '#sponsoredProducts',
    '#session-recommendations',
    '#rightCol',  // Exclude entire right column (contains ads)
    '#amsDetailRight-dramabot_feature_div',  // Specific ad placements
    '.celwidget[data-feature-name*="ams"]',  // Amazon Marketing Services ads
  ];

  const selectors = [
    '#corePrice_feature_div .a-price .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#price_inside_buybox',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    // '.a-price .a-offscreen', // Too broad, picks up related items
    '#buybox .a-price .a-offscreen',
    '#apex_desktop .a-price .a-offscreen',
    '.reinvent-PriceDisplay .a-offscreen',
    '#centerCol .a-price .a-offscreen' // Safer fallback than global
  ];

  for (const selector of selectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim()) {
      // Check if element is within excluded sections
      const isInExcludedSection = excludedSections.some(excludedSelector => {
        return element.closest(excludedSelector).length > 0;
      });

      if (!isInExcludedSection) {
        return {
          priceText: element.text().trim(),
          strategy: 'selector',
          selector
        };
      }
    }
  }

  return null;
}

/**
 * Strategy 2: Extract from buy box input fields
 */
function extractPriceFromBuyBox($) {
  const inputSelectors = [
    'input[name*="customerVisiblePrice"]',
    'input[id*="price"]',
    '#addToCart input[type="hidden"][name*="price"]'
  ];

  for (const selector of inputSelectors) {
    const input = $(selector).first();
    if (input.length) {
      const value = input.attr('value');
      if (value && !isNaN(parseFloat(value))) {
        return {
          priceText: value,
          strategy: 'input-field',
          selector
        };
      }
    }
  }

  return null;
}

/**
 * Strategy 3: Extract from JSON-LD structured data
 */
function extractPriceFromJSONLD($) {
  const scripts = $('script[type="application/ld+json"]');

  for (let i = 0; i < scripts.length; i++) {
    try {
      const jsonData = JSON.parse($(scripts[i]).html());

      // Check if it's a Product schema
      if (jsonData['@type'] === 'Product' && jsonData.offers) {
        const offers = Array.isArray(jsonData.offers) ? jsonData.offers[0] : jsonData.offers;
        if (offers.price) {
          return {
            priceText: offers.price.toString(),
            strategy: 'json-ld',
            selector: 'script[type="application/ld+json"]'
          };
        }
      }
    } catch (e) {
      // Invalid JSON, skip
    }
  }

  return null;
}

/**
 * MASTER: Multi-strategy price extraction
 */
function smartPriceExtraction($) {
  logger.debug('🔍 Running multi-strategy price detection...');

  const strategies = [
    { name: 'Selector-based', fn: function () { return extractPriceFromSelectors($); } },
    { name: 'Buy box input', fn: function () { return extractPriceFromBuyBox($); } },
    { name: 'JSON-LD', fn: function () { return extractPriceFromJSONLD($); } }
  ];

  const results = [];

  for (const strategy of strategies) {
    try {
      const result = strategy.fn();
      if (result) {
        logger.debug(`✅ ${strategy.name}: Found "${result.priceText}" using ${result.selector}`);
        results.push(result);
      } else {
        logger.debug(`❌ ${strategy.name}: No price found`);
      }
    } catch (error) {
      logger.error(`⚠️ ${strategy.name}: Error - ${error.message}`);
    }
  }

  // Return the first valid result
  if (results.length > 0) {
    return results[0];
  }

  return null;
}

// ============================================
// 3. DATA VALIDATION LAYER
// ============================================

/**
 * Validate extracted price
 */
function validatePrice(priceText) {
  if (!priceText || typeof priceText !== 'string') {
    return { valid: false, reason: 'Empty or invalid price text' };
  }

  // Remove currency symbols and whitespace
  const cleanPrice = priceText.replace(/[^\d.,]/g, '');

  if (!cleanPrice) {
    return { valid: false, reason: 'No numeric value in price text' };
  }

  // Parse price
  let price;
  if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
    // Handle formats like "1,234.56"
    price = parseFloat(cleanPrice.replace(/,/g, ''));
  } else if (cleanPrice.includes(',')) {
    // Handle formats like "1234,56" (European)
    price = parseFloat(cleanPrice.replace(',', '.'));
  } else {
    price = parseFloat(cleanPrice);
  }

  // Sanity checks
  if (isNaN(price) || price <= 0) {
    return { valid: false, reason: `Invalid price value: ${price}` };
  }

  if (price < 1 || price > 1000000) {
    return { valid: false, reason: `Price out of reasonable range: ${price} EGP` };
  }

  return { valid: true, price };
}

/**
 * Validate availability data
 */
function validateAvailability(availabilityData) {
  if (!availabilityData || typeof availabilityData !== 'object') {
    return { valid: false, reason: 'Invalid availability data structure' };
  }

  if (typeof availabilityData.isAvailable !== 'boolean') {
    return { valid: false, reason: 'Missing isAvailable flag' };
  }

  if (!availabilityData.reason) {
    return { valid: false, reason: 'Missing availability reason' };
  }

  return { valid: true };
}

// ============================================
// 4. ENHANCED DATA EXTRACTION
// ============================================

/**
 * Extract Merchant Information
 */
function extractMerchantInfo($) {
  // Try to find "Sold by" text
  const merchantSelectors = [
    '#merchant-info',
    '#sellerProfileTriggerId',
    '.offer-display-feature-text-message',
    '#tabular-buybox .a-row:contains("Sold by")',
    '#merchantInfoFeature_feature_div'
  ];

  for (const selector of merchantSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      // Clean up text (remove "Sold by", newlines, etc.)
      const cleanText = text.replace(/Sold by/i, '').trim();
      if (cleanText) return cleanText;
    }
  }

  return 'Amazon'; // Default fallback if not found (often means Amazon)
}

/**
 * Extract Delivery Information
 */
function extractDeliveryInfo($) {
  const deliverySelectors = [
    '#deliveryBlockMessage',
    '#mir-layout-DELIVERY_BLOCK-slot-PRIMARY_DELIVERY_MESSAGE_LARGE',
    '#delivery-message',
    '#ddmDeliveryMessage'
  ];

  for (const selector of deliverySelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().replace(/\s+/g, ' ').trim();

      // Extract date
      const dateMatch = text.match(/Arrives:? (.*?)(\.|$)/i) ||
        text.match(/Delivery (.*?)(\.|$)/i) ||
        text.match(/Get it (.*?)(\.|$)/i);

      // Extract price
      const priceMatch = text.match(/FREE delivery/i) ? 'FREE' :
        text.match(/EGP\s*\d+(\.\d{2})? delivery/i) ? text.match(/EGP\s*\d+(\.\d{2})? delivery/i)[0] : null;

      if (text) {
        return {
          message: text,
          date: dateMatch ? dateMatch[1].trim() : null,
          price: priceMatch || null
        };
      }
    }
  }

  return null;
}

/**
 * Extract Prime Status
 */
function extractPrimeStatus($) {
  const primeSelectors = [
    '#prime-badge',
    '.a-icon-prime',
    '#prime-popover-link',
    '#pe-prime-badge'
  ];

  for (const selector of primeSelectors) {
    if ($(selector).length > 0) return true;
  }

  return false;
}

/**
 * Extract Coupon Information
 */
function extractCouponInfo($) {
  const couponSelectors = [
    '#vpcButton',
    '.couponBadge',
    '#coupon-badge',
    'label[id*="coupon"]'
  ];

  for (const selector of couponSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      const match = text.match(/Save (.*?) with coupon/i) ||
        text.match(/Apply (.*?) coupon/i) ||
        text.match(/(.*?) coupon/i);

      if (match) return match[1].trim();
      if (text) return text;
    }
  }

  return null;
}

/**
 * Extract Deal Progress (Lightning Deals)
 */
function extractDealProgress($) {
  const progressSelectors = [
    '#dealProgress_feature_div',
    '.a-progress-bar',
    '#lightning-deal-progress-bar'
  ];

  for (const selector of progressSelectors) {
    const element = $(selector).first();
    if (element.length) {
      const text = element.text().trim();
      const match = text.match(/(\d+)%/);
      if (match) return parseInt(match[1]);

      // Check style width
      const style = element.find('.a-meter-bar').attr('style');
      if (style) {
        const widthMatch = style.match(/width:\s*(\d+)%/);
        if (widthMatch) return parseInt(widthMatch[1]);
      }
    }
  }

  return null;
}

/**
 * Extract Other Sellers
 */
function extractOtherSellers($) {
  // This is limited as full list is usually on a separate page, 
  // but we can check the "Other sellers on Amazon" box
  const otherSellers = [];

  const mbcs = $('#moreBuyingChoices_feature_div, #mbc');
  if (mbcs.length) {
    // This usually just shows a link or summary, hard to parse detailed list without visiting the page
    // But sometimes there are a few listed
    const price = mbcs.find('.a-price .a-offscreen').first().text().trim();
    if (price) {
      otherSellers.push({
        price: parseFloat(price.replace(/[^\d.]/g, '')),
        condition: 'New', // Assumption
        seller: 'Other Seller'
      });
    }
  }

  return otherSellers;
}

async function getPrice(url) {
  try {
    logger.debug(`🌐 Fetching: ${url}`);

    // ============================================
    // ENHANCED REQUEST CONFIGURATION
    // ============================================
    const userAgents = [
      // Chrome on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      // Chrome on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      // Firefox on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
      // Firefox on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:123.0) Gecko/20100101 Firefox/123.0',
      // Safari on macOS
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
      // Edge on Windows
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0'
    ];

    const randomUserAgent = userAgents[Math.floor(Math.random() * userAgents.length)];

    const response = await axios.get(url, {
      headers: {
        'User-Agent': randomUserAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"', // Or "Windows" randomly if you want to be fancy
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 15000,
      decompress: true // Important for gzip/br
    });

    const $ = cheerio.load(response.data);

    // Check for captcha
    // Check for captcha
    if ($('title').text().includes('Robot Check') ||
      $('form[action*="/errors/validateCaptcha"]').length > 0 ||
      $('body').text().includes('validateCaptcha') ||
      $('body').text().includes('Enter the characters you see below') ||
      $('input[name="amzn"]').length > 0) {
      throw new Error('Amazon Captcha detected');
    }

    // ============================================
    // STEP 1: Smart Availability Check
    // ============================================
    return extractFromCheerio($, url);

  } catch (error) {
    // Check if we should try the fallback (Puppeteer)
    const isCaptcha = error.message.includes('Captcha') || error.message.includes('Robot Check');
    const isForbidden = error.response && (error.response.status === 403 || error.response.status === 503);
    const isNetworkError = error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT';

    // If it's a blocking issue, try Puppeteer
    if (isCaptcha || isForbidden || isNetworkError) {
      logger.warn(`⚠️ Axios failed (${error.message}). Attempting Puppeteer fallback...`);
      try {
        return await fetchWithPuppeteer(url);
      } catch (puppeteerError) {
        logger.error(`❌ Puppeteer fallback also failed: ${puppeteerError.message}`);
        // Throw the original error or a combined one? 
        // Let's throw the Puppeteer error as it's the final attempt
        throw puppeteerError;
      }
    }

    if (error.message.includes('out-of-stock') ||
      error.message.includes('third-party') ||
      error.message.includes('unavailable') ||
      error.message.includes('no-buybox') ||
      error.message.includes('no-buy-box')) {
      // This is an expected "error" - product is just not available
      throw error;
    }

    logger.error(`❌ Error scraping ${url}: ${error.message}`);
    throw error;
  }
}

/**
 * Extracted logic for processing Cheerio instance
 */
function extractFromCheerio($, url) {
  // ============================================
  // STEP 1: Smart Availability Check
  // ============================================
  const availabilityCheck = smartAvailabilityCheck($);

  // Validate availability data
  const availValidation = validateAvailability(availabilityCheck);
  if (!availValidation.valid) {
    logger.error(`❌ Availability validation failed: ${availValidation.reason}`);
  }

  if (!availabilityCheck.isAvailable) {
    logger.info(`❌ Product unavailable: ${availabilityCheck.reason}`);
    throw new Error(`Product is ${availabilityCheck.reason}: ${availabilityCheck.details}`);
  }

  // ============================================
  // STEP 2: Multi-Strategy Price Extraction
  // ============================================
  const priceResult = smartPriceExtraction($);

  if (!priceResult) {
    // Last resort: check if we can find any price-like text in buy box
    const buyBoxText = $('#buybox, #centerCol').text();
    const priceMatch = buyBoxText.match(/[EGP$€EGP]+\s*(\d{1,6}(?:[.,]\d{2})?)/);

    if (priceMatch) {
      logger.warn(`⚠️ Fallback regex found price: ${priceMatch[0]}`);
      const validation = validatePrice(priceMatch[1]);

      if (validation.valid) {
        return {
          currentPrice: validation.price,
          isOutOfStock: false,
          extractionMethod: 'fallback-regex'
        };
      }
    }

    logger.error('❌ All price extraction strategies failed');
    logger.warn(`Availability text was: "${availabilityCheck.details}"`);
    throw new Error('Price not found - page structure may have changed');
  }

  // ============================================
  // STEP 3: Validate Price
  // ============================================
  const priceValidation = validatePrice(priceResult.priceText);

  if (!priceValidation.valid) {
    logger.error(`❌ Price validation failed: ${priceValidation.reason}`);
    throw new Error(`Invalid price data: ${priceValidation.reason}`);
  }

  // ============================================
  // STEP 4: Enhanced Data Extraction
  // ============================================
  const merchant = extractMerchantInfo($);
  const delivery = extractDeliveryInfo($);
  const prime = extractPrimeStatus($);
  const coupon = extractCouponInfo($);
  const dealProgress = extractDealProgress($);
  const otherSellers = extractOtherSellers($);

  logger.debug(`✅ Successfully extracted price: ${priceValidation.price} EGP (strategy: ${priceResult.strategy})`);
  if (merchant) logger.debug(`🏪 Merchant: ${merchant}`);
  if (prime) logger.debug(`🚛 Prime: Yes`);

  return {
    currentPrice: priceValidation.price,
    isOutOfStock: false,
    extractionMethod: priceResult.strategy,
    selector: priceResult.selector,
    // Enhanced fields
    merchant,
    delivery,
    prime,
    coupon,
    dealProgress,
    otherSellers
  };
}

// Initialize puppeteer-extra only once to prevent memory leaks/re-registration issues
let puppeteerInstance = null;

async function getPuppeteer() {
  if (puppeteerInstance) return puppeteerInstance;

  const puppeteer = (await import('puppeteer-extra')).default;
  const StealthPlugin = (await import('puppeteer-extra-plugin-stealth')).default;
  puppeteer.use(StealthPlugin());

  puppeteerInstance = puppeteer;
  return puppeteerInstance;
}

/**
 * Fallback: Fetch with Puppeteer (Stealth Mode)
 */
async function fetchWithPuppeteer(url) {
  logger.info('🚀 Launching Puppeteer fallback (Stealth Mode)...');
  let browser = null;
  // Use a unique user data dir to avoid conflicts
  const userDataDir = `/tmp/puppeteer_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  try {
    const puppeteer = await getPuppeteer();



    browser = await puppeteer.launch({
      headless: 'new',
      userDataDir, // Explicitly set unique dir
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu',
        '--disable-extensions',
        '--disable-component-extensions-with-background-pages',
        '--disable-default-apps',
        '--mute-audio',
        '--no-default-browser-check',
        '--autoplay-policy=user-gesture-required',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-notifications',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-component-update',
        '--disable-domain-reliability',
        '--disable-sync',
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    });
    const page = await browser.newPage();

    // Set realistic user agent (Stealth plugin handles most, but this helps)
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

    // Optimize page loading
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const resourceType = req.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Randomize viewport slightly
    await page.setViewport({
      width: 1920 + Math.floor(Math.random() * 100),
      height: 1080 + Math.floor(Math.random() * 100),
      deviceScaleFactor: 1,
      hasTouch: false,
      isLandscape: false,
      isMobile: false,
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 }); // Increased timeout

    // Check for Captcha
    const title = await page.title();
    if (title.includes('Robot Check')) {
      throw new Error('Puppeteer also hit Captcha (even with Stealth)');
    }

    const content = await page.content();
    const $ = cheerio.load(content);
    return extractFromCheerio($, url);
  } catch (error) {
    logger.error(`Puppeteer failed: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {
        logger.error(`Error closing browser: ${e.message}`);
      }
    }
    // Clean up temporary user data dir
    try {
      if (userDataDir && userDataDir.includes('/tmp/puppeteer_profile_')) {
        await fs.rm(userDataDir, { recursive: true, force: true });
        logger.debug(`🧹 Cleaned up Puppeteer profile: ${userDataDir}`);
      }
    } catch (cleanupError) {
      logger.warn(`Failed to cleanup temp dir ${userDataDir}: ${cleanupError.message}`);
    }
  }
}

/**
 * Main Wrapper with Retry Logic
 */
async function getPriceWithRetry(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      if (i > 0) {
        const delay = Math.floor(Math.random() * 3000) + 2000; // 2-5s delay
        logger.info(`⏳ Retry ${i}/${retries} after ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
      }

      return await getPrice(url);
    } catch (error) {
      // If it's a permanent failure (like product not found), don't retry
      if (error.message.includes('Product is') || error.message.includes('Price not found')) {
        throw error;
      }

      logger.warn(`⚠️ Attempt ${i + 1} failed: ${error.message}`);

      if (i === retries) {
        throw error;
      }
    }
  }
}



export { getPriceWithRetry as getPrice };
