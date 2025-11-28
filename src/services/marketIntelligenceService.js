import axios from 'axios';
import { logger } from '../utils/logger.js';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/chat/completions';
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
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        if (!this.apiKey) {
            logger.warn('PERPLEXITY_API_KEY is not set. Market Intelligence features will be disabled.');
        }
    }

    async _callPerplexity(systemPrompt, userMessage, model = MODEL_FAST) {
        if (!this.apiKey) {
            throw new Error('Perplexity API key is missing.');
        }

        try {
            const response = await axios.post(
                PERPLEXITY_API_URL,
                {
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.2
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const content = response.data.choices[0].message.content;

            // Attempt to parse JSON (handle potential markdown code blocks or chatty text)
            let jsonString = content;
            const codeBlockMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (codeBlockMatch) {
                jsonString = codeBlockMatch[1];
            } else {
                // Fallback: try to find the first { and last }
                const firstBrace = content.indexOf('{');
                const lastBrace = content.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    jsonString = content.substring(firstBrace, lastBrace + 1);
                }
            }
            return JSON.parse(jsonString);

        } catch (error) {
            logger.error('Perplexity API Error:', error.response?.data || error.message);
            throw error;
        }
    }

    /**
     * Search for products based on natural language query.
     * @param {string} query - User's shopping query
     * @returns {Promise<Object>} - { summary, products: [] }
     */
    async searchProduct(query) {
        logger.info(`Market Intelligence: Searching for "${query}"`);
        return this._callPerplexity(PROMPT_SEARCH_PRODUCT, query, MODEL_RESEARCH);
    }

    /**
     * Compare prices across other platforms.
     * @param {string} productName - Name of the product
     * @returns {Promise<Object>} - { competitors: [], lowestPrice, lowestPlatform }
     */
    async comparePrices(productName) {
        logger.info(`Market Intelligence: Comparing prices for "${productName}"`);
        const query = `Find the price of "${productName}" in Egypt on Noon, Jumia, and other major retailers.`;
        return this._callPerplexity(PROMPT_COMPARE_PRICES, query, MODEL_FAST);
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
        return this._callPerplexity(PROMPT_ANALYZE_DEAL, query, MODEL_RESEARCH);
    }
}

export const marketIntelligenceService = new MarketIntelligenceService();
