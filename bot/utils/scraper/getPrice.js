// src/scraper/getPrice.js
import * as cheerio from 'cheerio';
import axios from 'axios';

async function getPrice(url) {
  try {
    const headers = { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    };
    
    const response = await axios.get(url, { 
      headers,
      timeout: 15000,
      maxRedirects: 5
    });
    
    const html = response.data;
    const $ = cheerio.load(html);

    // Check if product is available first
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
        if (availabilityText) {
          console.log(`Availability status: ${availabilityText}`);
          break;
        }
      }
    }

    // Check for out of stock indicators with more precise matching
    // Use word boundaries to avoid false positives (e.g., "available" containing "unavailable")
    const outOfStockPatterns = [
      /\bcurrently unavailable\b/,
      /\btemporarily unavailable\b/,
      /\bout of stock\b/,
      /\btemporarily out of stock\b/,
      /\bnot available\b/,
      /\bunavailable\b(?!.*\bavailable\b)/  // "unavailable" but not followed by "available"
    ];

    const isOutOfStock = outOfStockPatterns.some(pattern => 
      pattern.test(availabilityText)
    );

    if (isOutOfStock) {
      console.log(`Product detected as out of stock. Availability text: "${availabilityText}"`);
      throw new Error('Product is currently out of stock or unavailable');
    }
    
    // Additional check: if availability text suggests product IS available, log it
    const inStockKeywords = ['in stock', 'available', 'ships from', 'dispatches from'];
    const seemsInStock = inStockKeywords.some(keyword => availabilityText.includes(keyword));
    if (seemsInStock) {
      console.log(`Product appears to be in stock: "${availabilityText}"`);
    }

    // Priority-ordered selectors - MOST SPECIFIC FIRST to avoid related products
    // These selectors target the main product price area only
    const selectors = [
      // Highest priority - Main product price containers (2024+ layouts)
      '#corePriceDisplay_desktop_feature_div .a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      '#corePrice_desktop .a-price .a-offscreen',
      
      // Price to pay (new Amazon layout)
      '.priceToPay .a-offscreen',
      'span.priceToPay .a-offscreen',
      '.a-price.priceToPay .a-offscreen',
      
      // Buy box price (various formats)
      '#price_inside_buybox',
      '.a-section.a-spacing-none.aok-align-center #price_inside_buybox',
      
      // Deal/Sale prices (specific to main product)
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '#priceblock_saleprice',
      
      // Apex price (newer format)
      '#apex_desktop .a-price .a-offscreen',
      '#apex_desktop .apexPriceToPay .a-offscreen',
      '.apex_offerDisplay_desktop .a-price .a-offscreen',
      
      // Alternative main product selectors
      '.a-box-inner .a-price .a-offscreen',
      '#buybox .a-price .a-offscreen',
      
      // Fallback - any price in main content area (last resort)
      '#centerCol .a-price .a-offscreen',
      '#rightCol .a-price .a-offscreen',
    ];

    let priceText = null;
    let foundSelector = null;
    
    // Try each selector in order
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        // Additional validation: make sure we're not in a "related products" section
        const parent = element.closest('html').html();
        const isInSimilarProducts = element.closest('#similarities_feature_div, #sims-fbt, #sp_detail, [data-feature-name="aplus"]').length > 0;
        
        if (!isInSimilarProducts) {
          priceText = element.text().trim();
          foundSelector = selector;
          console.log(`Found price with selector: ${selector} - ${priceText}`);
          break;
        } else {
          console.log(`Skipping price from related products section for selector: ${selector}`);
        }
      }
    }

    if (!priceText) {
      console.error('Price not found with any selector');
      console.log('Available price elements on page:');
      const allPrices = [];
      $('.a-price .a-offscreen').each((i, el) => {
        const priceVal = $(el).text().trim();
        console.log(`  ${i}: ${priceVal}`);
        allPrices.push(priceVal);
      });
      
      // Last resort: try to find ANY price-like text in the buy box area
      console.log('Attempting fallback price extraction...');
      const buyBoxArea = $('#buybox, #centerCol, #apex_desktop').first();
      if (buyBoxArea.length) {
        const buyBoxText = buyBoxArea.text();
        // Look for price patterns like £XX.XX, $XX.XX, EGP XX.XX, or just numbers
        const pricePatterns = [
          /(?:EGP|£|€|\$)\s*(\d{1,5}(?:[.,]\d{2})?)/i,  // Currency prefix with space
          /(\d{1,5}(?:[.,]\d{2})?)\s*(?:EGP|£|€|\$)/i,  // Currency suffix
          /[£$€]\s*(\d{1,5}(?:[.,]\d{2})?)/,            // Symbol prefix
        ];
        
        for (const pattern of pricePatterns) {
          const priceMatch = buyBoxText.match(pattern);
          if (priceMatch) {
            priceText = priceMatch[0];
            foundSelector = 'fallback-regex';
            console.log(`Found price with fallback regex: ${priceText}`);
            break;
          }
        }
      }
      
      // If still no price found but we have prices in the array, use the first one
      // BUT ONLY if we're confident the product is in stock
      if (!priceText && allPrices.length > 0 && seemsInStock) {
        // Only use fallback if product appears to be in stock
        console.log('Attempting to use fallback price since product appears in stock...');
        
        // Try to get prices ONLY from main product area, not similar products
        const mainProductPrices = [];
        $('#centerCol .a-price .a-offscreen, #rightCol .a-price .a-offscreen, #buybox .a-price .a-offscreen').each((i, el) => {
          const $el = $(el);
          // Exclude prices from specific similar/related product sections
          const isInExcludedSection = $el.closest(
            '#similarities_feature_div, ' +
            '#sims-fbt, ' +
            '#sp_detail, ' +
            '#aplus, ' +
            '[data-feature-name="aplus"], ' +
            '[cel_widget_id*="similar"], ' +
            '[cel_widget_id*="compare"], ' +
            '[cel_widget_id*="sims"], ' +
            '.a-carousel-container'
          ).length > 0;
          
          if (!isInExcludedSection) {
            const priceVal = $el.text().trim();
            mainProductPrices.push(priceVal);
            console.log(`  Main area price ${i}: ${priceVal}`);
          }
        });
        
        if (mainProductPrices.length > 0) {
          // Filter out unreasonably high prices (likely errors)
          const reasonablePrices = mainProductPrices.filter(p => {
            const num = parseFloat(p.replace(/[^\d.]/g, ''));
            return !isNaN(num) && num > 0 && num < 50000;
          });
          
          if (reasonablePrices.length > 0) {
            priceText = reasonablePrices[0];
            foundSelector = 'fallback-main-area-price';
            console.log(`Using first main area price as fallback: ${priceText}`);
          }
        }
      }
      
      // If still no price found
      if (!priceText) {
        // If we couldn't find price but product seems available, it's a scraping issue
        // If availability suggests out of stock, throw appropriate error
        if (availabilityText) {
          console.log(`Availability check: "${availabilityText}"`);
          // Re-check with looser patterns if no price found
          if (availabilityText.includes('unavailable') || 
              availabilityText.includes('out of stock') ||
              availabilityText.includes('not available')) {
            throw new Error('Product is currently out of stock or unavailable');
          }
        }
        
        // If no availability text found at all, it might be out of stock
        if (!availabilityText || availabilityText.length === 0) {
          console.log('No availability information found - product may be out of stock');
          throw new Error('Product is currently out of stock or unavailable');
        }
        
        throw new Error('Price not found - page structure may have changed');
      }
    }
    
    // Clean and convert price string
    // Remove currency symbols (£, $, €, EGP), commas, and spaces
    priceText = priceText.replace(/EGP/gi, '').replace(/[^\d.,]/g, '');
    
    // Handle different decimal separators
    // If there's both comma and dot, assume dot is decimal
    if (priceText.includes(',') && priceText.includes('.')) {
      priceText = priceText.replace(/,/g, '');
    } else if (priceText.includes(',')) {
      // Assume comma is decimal separator (European format)
      priceText = priceText.replace(',', '.');
    }
    
    const price = parseFloat(priceText);
    
    if (isNaN(price) || price <= 0) {
      console.error('Invalid price after parsing:', priceText);
      throw new Error('Invalid price format');
    }
    
    console.log(`Successfully extracted price: ${price} (using selector: ${foundSelector})`);
    return price;
    
  } catch (error) {
    console.error('Error in getPrice:', error.message);
    throw error;
  }
}

export { getPrice };