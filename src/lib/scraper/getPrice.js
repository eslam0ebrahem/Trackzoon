// src/scraper/getPrice.js
import * as cheerio from 'cheerio';
import axios from 'axios';

async function getPrice(url) {
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
  const response = await axios.get(url, { headers }); // Use axios.get
  const html = response.data; // Axios puts data in .data
  const $ = cheerio.load(html);

  // Look for most common price selectors
  let priceText = $('#priceblock_dealprice').text()
              || $('#priceblock_ourprice').text()
              || $('.a-price .a-offscreen').first().text();

  if (!priceText) throw new Error('Price not found!');
  // Clean and convert price string
  priceText = priceText.replace(/[^\d.]/g, '');
  const price = parseFloat(priceText);
  return isNaN(price) ? null : price;
}

export { getPrice };