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
        You are an expert shopping assistant. Analyze this product deal for the Egyptian market (Amazon Egypt).
        
        Product: ${product.name}
        Current Price: EGP ${product.currentPrice}
        Url: ${product.url}
        
        Context:
        - 30-day Low: EGP ${product.stats?.min || 'N/A'}
        - 30-day Average: EGP ${product.stats?.avg || 'N/A'}
        - 30-day High: EGP ${product.stats?.max || 'N/A'}
        
        Is this a good deal? Consider the product's value, brand reputation, and current market price in Egypt.
        
        Return ONLY a JSON object with this format (no markdown, no extra text):
        {
          "score": <number 0-100, where 0 is terrible and 100 is an amazing steal>,
          "reason": "<one short sentence explaining why, max 15 words>"
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
}

export const aiService = new AiService();
