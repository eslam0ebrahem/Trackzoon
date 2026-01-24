import { logger } from '../utils/logger.js';
import { aiService } from './aiService.js';

const MODEL_RESEARCH = 'sonar-pro'; // Deep research
const MODEL_FAST = 'sonar'; // Fast queries

// System Prompts
const PROMPT_SEARCH_PRODUCT = `
You are a Smart Shopping Assistant for Egypt.
Your goal is to find the best products on Amazon Egypt based on the user's query.
You must return a JSON object with a brief summary and a list of products.
The JSON format must be strictly:
{
  "summary": "Brief explanation of why these are the best options.",
  "products": [
    {
      "title": "Product Name",
      "price": "Approximate Price in EGP (number only)",
      "url": "Valid Amazon.eg URL",
      "reason": "Why this is a good choice"
    }
  ]
}
Do not include any text outside the JSON.
`;

const PROMPT_COMPARE_PRICES = `
You are a Price Comparison Engine for Egypt.
Check the current price of the given product on major Egyptian retailers (Noon, Jumia, B.TECH, 2B, etc.).
Return a strict JSON object:
{
  "competitors": [
    {
      "platform": "Retailer Name",
      "price": 1234.56,
      "url": "Direct link to product",
      "currency": "EGP"
    }
  ],
  "lowestPrice": 1234.56,
  "lowestPlatform": "Retailer Name"
}
If no competitors are found, return an empty competitors array.
Do not include any text outside the JSON.
`;

const PROMPT_ANALYZE_DEAL = `
You are a Tech Buying Advisor.
Analyze the given product for "Buyer's Remorse" risks.
Search for:
1. Upcoming successors or new models releasing soon.
2. Known major defects or recall issues.
3. Recent price trends or better value alternatives.
Return a strict JSON object:
{
  "advice": "buy_now" | "wait" | "neutral",
  "reasoning": "Concise reason for the advice.",
  "newsSummary": "Summary of relevant news (e.g., 'Mark II releasing next month')."
}
Do not include any text outside the JSON.
`;

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
                systemPrompt: PROMPT_SEARCH_PRODUCT,
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
                systemPrompt: PROMPT_COMPARE_PRICES,
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
                systemPrompt: PROMPT_ANALYZE_DEAL,
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

