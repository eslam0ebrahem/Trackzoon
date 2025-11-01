import * as cheerio from 'cheerio';
import axios from 'axios';

async function getProductName(url) {
  const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9' };
  const response = await axios.get(url, { headers }); // Use axios.get
  const html = response.data; // Axios puts data in .data
  const $ = cheerio.load(html);

  // Most Amazon product pages use this selector for the product title
  const name = $('#productTitle').text().trim() || $('span#productTitle').text().trim();
  return name || 'Unknown Product';
}

export { getProductName };