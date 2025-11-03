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

    // Try multiple price selectors (Amazon uses different ones across regions)
    const selectors = [
      // Common selectors
      '.a-price .a-offscreen',
      '#priceblock_dealprice',
      '#priceblock_ourprice',
      '#priceblock_saleprice',
      '.a-price-whole',
      
      // New Amazon layout
      '.a-price[data-a-size="xl"] .a-offscreen',
      '.a-price[data-a-size="l"] .a-offscreen',
      '.a-price[data-a-color="price"] .a-offscreen',
      
      // Alternative selectors
      '#corePrice_feature_div .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-offscreen',
      '.priceToPay .a-offscreen',
      'span.a-price-whole',
      
      // Fallback selectors
      '[data-action="show-all-offers-display"] .a-offscreen',
      '.reinventPricePriceToPayMargin .a-offscreen'
    ];

    let priceText = null;
    
    // Try each selector
    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim()) {
        priceText = element.text().trim();
        console.log(`Found price with selector: ${selector} - ${priceText}`);
        break;
      }
    }

    if (!priceText) {
      console.error('Price not found with any selector');
      throw new Error('Price not found!');
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
    
    console.log(`Successfully extracted price: ${price}`);
    return price;
    
  } catch (error) {
    console.error('Error in getPrice:', error.message);
    throw error;
  }
}

export { getPrice };