import { Injectable } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

@Injectable()
export class ScraperService {
  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Upgrade-Insecure-Requests': '1',
  };

  async getProductName(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);
      
      // Try multiple selectors for product name
      const name =
        $('#productTitle').text().trim() ||
        $('[id*="productTitle"]').first().text().trim() ||
        $('h1.product-title').text().trim() ||
        $('h1').first().text().trim();

      return name || null;
    } catch (error) {
      console.error('Error scraping product name:', error.message);
      return null;
    }
  }

  async getPrice(url: string): Promise<number | null> {
    try {
      const response = await axios.get(url, {
        headers: this.headers,
        timeout: 10000,
      });

      const $ = cheerio.load(response.data);

      // Try multiple selectors for price
      const priceSelectors = [
        '.a-price .a-offscreen',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price-whole',
        '[data-a-color="price"]',
        '.priceToPay .a-offscreen',
      ];

      for (const selector of priceSelectors) {
        const priceText = $(selector).first().text().trim();
        if (priceText) {
          const price = this.parsePrice(priceText);
          if (price) return price;
        }
      }

      return null;
    } catch (error) {
      console.error('Error scraping price:', error.message);
      return null;
    }
  }

  private parsePrice(priceText: string): number | null {
    // Remove currency symbols and extract number
    const cleaned = priceText.replace(/[^0-9.,]/g, '');
    const normalized = cleaned.replace(/,/g, '.');
    const price = parseFloat(normalized);
    return isNaN(price) ? null : price;
  }
}
