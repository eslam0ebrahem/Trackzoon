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

    // Check for out of stock indicators
    const outOfStockKeywords = [
      'currently unavailable',
      'out of stock',
      'not available',
      'temporarily out of stock',
      'unavailable'
    ];

    const isOutOfStock = outOfStockKeywords.some(keyword => 
      availabilityText.includes(keyword)
    );

    if (isOutOfStock) {
      console.log('Product is out of stock or unavailable');
      throw new Error('Product is currently out of stock or unavailable');
    }

    // Priority-ordered selectors - MOST SPECIFIC FIRST to avoid related products
    // These selectors target the main product price area only
    const selectors = [
      // Highest priority - Main product price containers
      '#corePriceDisplay_desktop_feature_div .a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
      '#corePrice_feature_div .a-price .a-offscreen',
      
      // Price to pay (new Amazon layout)
      '.priceToPay .a-offscreen',
      'span.priceToPay .a-offscreen',
      
      // Buy box price
      '#price_inside_buybox',
      
      // Deal/Sale prices (specific to main product)
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '#priceblock_saleprice',
      
      // Alternative main product selectors
      '#apex_desktop .a-price .a-offscreen',
      '.a-box-inner .a-price .a-offscreen',
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
      $('.a-price .a-offscreen').each((i, el) => {
        console.log(`  ${i}: ${$(el).text().trim()}`);
      });
      throw new Error('Price not found - product may be unavailable or page structure changed');
    }
    
    // Clean and convert price string
    // Remove currency symbols, commas, and spaces
    priceText = priceText.replace(/[^\d.,]/g, '');
    
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