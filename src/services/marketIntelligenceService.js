import { logger } from '../utils/logger.js';
import { aiService } from './aiService.js';
import { SystemPrompts } from '../utils/prompts.js';

const MODEL_RESEARCH = 'sonar-pro'; // Deep research
const MODEL_FAST = 'sonar'; // Fast queries

class MarketIntelligenceService {
  /**
   * Search for products based on natural language query.
   * @param {string} query - User's shopping query
   * @returns {Promise<Object>} - { summary, products: [] }
   */
  async searchProduct(query) {
    logger.info(`Market Intelligence: Searching for "${query}"`);
    try {
      return await aiService.ask({
        systemPrompt: SystemPrompts.PRODUCT_SEARCH_JSON,
        userPrompt: query,
        model: MODEL_RESEARCH,
        jsonMode: true
      });
    } catch (error) {
      logger.error('Market Intelligence Search failed', error);
      return { summary: "Search unavailable", products: [] };
    }
  }

  /**
   * Compare prices across other platforms.
   * @param {string} productName - Name of the product
   * @returns {Promise<Object>} - { competitors: [], lowestPrice, lowestPlatform }
   */
  async comparePrices(productName) {
    logger.info(`Market Intelligence: Comparing prices for "${productName}"`);
    const query = `Find the price of "${productName}" in Egypt on Noon, Jumia, and other major retailers.`;
    try {
      return await aiService.ask({
        systemPrompt: SystemPrompts.PRICE_COMPARE_JSON,
        userPrompt: query,
        model: MODEL_FAST,
        jsonMode: true
      });
    } catch (error) {
      logger.error('Market Intelligence Price Compare failed', error);
      return { competitors: [], lowestPrice: 0, lowestPlatform: "None" };
    }
  }

  /**
   * Analyze if it's a good time to buy.
   * @param {string} productName - Name of the product
   * @param {number} currentPrice - Current price
   * @returns {Promise<Object>} - { advice, reasoning, newsSummary }
   */
  async analyzeDeal(productName, currentPrice) {
    logger.info(`Market Intelligence: Analyzing deal for "${productName}" at ${currentPrice}`);
    const query = `Analyze this deal: "${productName}" at ${currentPrice} EGP. Is a new model coming out? Are there defects?`;
    try {
      return await aiService.ask({
        systemPrompt: SystemPrompts.TECH_ADVISOR_JSON,
        userPrompt: query,
        model: MODEL_RESEARCH,
        jsonMode: true
      });
    } catch (error) {
      logger.error('Market Intelligence Deal Analysis failed', error);
      // Fallback object
      return { advice: "neutral", reasoning: "AI analysis unavailable", newsSummary: "" };
    }
  }
}

export const marketIntelligenceService = new MarketIntelligenceService();

