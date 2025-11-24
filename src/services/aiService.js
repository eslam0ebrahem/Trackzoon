import axios from 'axios';
import { logger } from '../utils/logger.js';

export class AiService {
    constructor() {
        this.apiKey = process.env.PERPLEXITY_API_KEY;
        this.apiUrl = 'https://api.perplexity.ai/chat/completions';
    }

    /**
     * Analyze a product deal using Perplexity AI
     * @param {Object} product - Product object
     * @returns {Promise<Object>} - { score: number, reason: string }
     */
    async analyzeDeal(product) {
        if (!this.apiKey) {
            logger.warn('Skipping AI analysis: PERPLEXITY_API_KEY not configured');
            return null;
        }

        try {
            const prompt = `
        You are a strict, expert shopping assistant for the Egyptian market (Amazon Egypt).
        Evaluate this deal based on value for money, price history, and market context.

        Product: ${product.name}
        Current Price: EGP ${product.currentPrice}
        Url: ${product.url}
        
        Price Context:
        - Change: ${product.priceChange > 0 ? '+' : ''}${product.priceChange}% ${product.priceChange < 0 ? '(DROP)' : ''}
        - Trend: ${product.trend || 'Unknown'}
        - Volatility: ${product.volatility || 'Unknown'}
        - 30-day Low: EGP ${product.stats?.min || 'N/A'}
        - 30-day Average: EGP ${product.stats?.avg || 'N/A'}
        - 30-day High: EGP ${product.stats?.max || 'N/A'}
        
        Task:
        1. Rate this deal from 0-100. Be strict. 
           - 90-100: Absolute steal, buy immediately (rare).
           - 70-89: Great deal, highly recommended.
           - 50-69: Fair price, okay to buy if needed.
           - 0-49: Bad price, overpriced, or fake deal.
        2. Provide a punchy, 15-word reason.

        Return ONLY a JSON object:
        {
          "score": <number>,
          "reason": "<string>"
        }
      `;

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'sonar',
                    messages: [
                        { role: 'system', content: 'You are a helpful shopping assistant that outputs only valid JSON.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.1
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000 // 30s timeout
                }
            );

            const content = response.data.choices[0].message.content;

            // Clean up markdown code blocks if present
            const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();

            const result = JSON.parse(jsonString);

            return {
                score: Math.min(100, Math.max(0, parseInt(result.score) || 50)),
                reason: result.reason || 'AI analysis unavailable'
            };

        } catch (error) {
            if (error.response) {
                logger.error(`AI Analysis API Error: ${JSON.stringify(error.response.data)}`);
            }
            logger.error(`AI Analysis failed for ${product.asin}:`, error.message);
            return null;
        }
    }

    /**
     * Answer a user's question with context from their tracked products
     * @param {string} query - User's question
     * @param {Array} products - List of user's tracked products
     * @returns {Promise<string>} - AI response
     */
    async answerQuestion(query, products) {
        if (!this.apiKey) return "I'm sorry, my AI brain is not connected right now (API Key missing).";

        try {
            // Summarize product context to save tokens
            const productContext = products.map(p =>
                `- ${p.name.substring(0, 50)}...: EGP ${p.currentPrice} (Score: ${p.smartScore || 'N/A'})`
            ).join('\n');

            const prompt = `
        You are a helpful shopping assistant for Amazon Egypt.
        
        User's Question: "${query}"
        
        User's Tracked Products:
        ${productContext}
        
        Answer the question based on the tracked products and your general knowledge. 
        If the user asks for recommendations, suggest from their list if applicable.
        Keep the answer concise (max 3 sentences) and helpful.
      `;

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'sonar',
                    messages: [
                        { role: 'system', content: 'You are a helpful shopping assistant.' },
                        { role: 'user', content: prompt }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                }
            );

            return response.data.choices[0].message.content;

        } catch (error) {
            logger.error('AI Question failed:', error.message);
            return "I'm having trouble thinking right now. Please try again later.";
        }
    }

    /**
     * Categorize a product and generate tags using AI
     * @param {string} name - Product name
     * @returns {Promise<{category: string, tags: string[]}>}
     */
    async categorizeProduct(name) {
        if (!this.apiKey) return { category: 'Uncategorized', tags: [] };

        try {
            const prompt = `
        Categorize this product for an e-commerce dashboard.
        Product: "${name}"
        
        Return ONLY a JSON object:
        {
          "category": "<One broad category e.g. Electronics, Home, Fashion, Gaming, Beauty>",
          "tags": ["<tag1>", "<tag2>", "<tag3>"] (Max 3 specific tags)
        }
      `;

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'sonar',
                    messages: [
                        { role: 'system', content: 'You are a helpful assistant that outputs only valid JSON.' },
                        { role: 'user', content: prompt }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 10000
                }
            );

            const content = response.data.choices[0].message.content;
            const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            logger.error('AI Categorization failed:', error.message);
            return { category: 'Uncategorized', tags: [] };
        }
    }

    /**
     * Predict price trend using AI
     * @param {Object} product - Product object with history
     * @returns {Promise<{trend: string, confidence: number, reason: string}>}
     */
    async predictTrend(product) {
        if (!this.apiKey) return null;

        try {
            // Simplify history for prompt
            const history = product.priceHistory.slice(-10).map(h => h.price).join(', ');

            const prompt = `
        Analyze the price trend for this product.
        Product: ${product.name}
        Recent Prices (Oldest to Newest): [${history}]
        Current Price: ${product.currentPrice}
        
        Will the price likely DROP, RISE, or STAY STABLE in the next 7 days?
        
        Return ONLY a JSON object:
        {
          "trend": "<DROP|RISE|STABLE>",
          "confidence": <0.0 to 1.0>,
          "reason": "<Very short reason>"
        }
      `;

            const response = await axios.post(
                this.apiUrl,
                {
                    model: 'sonar',
                    messages: [
                        { role: 'system', content: 'You are a financial analyst that outputs only valid JSON.' },
                        { role: 'user', content: prompt }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 15000
                }
            );

            const content = response.data.choices[0].message.content;
            const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonString);
        } catch (error) {
            logger.error('AI Prediction failed:', error.message);
            return null;
        }
    }
}

export const aiService = new AiService();
