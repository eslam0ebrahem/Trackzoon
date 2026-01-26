import axios from 'axios';
import { logger } from '../utils/logger.js';
import { SystemPrompts } from '../utils/prompts.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { cleanHtml } from '../utils/htmlCleaner.js';

export class AiService {
    constructor() {
        this.perplexityKey = process.env.PERPLEXITY_API_KEY;
        this.geminiKey = process.env.GEMINI_API_KEY;
        this.perplexityUrl = 'https://api.perplexity.ai/chat/completions';
        this.geminiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

        // Parse providers from env, default to PERPLEXITY then GEMINI
        const envProviders = process.env.AI_PROVIDERS || 'PERPLEXITY,GEMINI';
        this.providers = envProviders.split(/[,&]/) // Support comma or & as separator
            .map(p => p.trim().toUpperCase())
            .filter(p => p);
    }

    /**
     * Generic method to call AI with Dynamic Fallback
     * @param {Object} options - { systemPrompt, userPrompt, model, temperature, jsonMode }
     * @returns {Promise<any>} - Parsed JSON or string content
     */
    async ask({ systemPrompt, userPrompt, model = 'sonar', temperature = 0.2, jsonMode = false }) {
        let lastError = null;

        for (const provider of this.providers) {
            try {
                if (provider === 'PERPLEXITY') {
                    const result = await this.askPerplexity({ systemPrompt, userPrompt, model, temperature, jsonMode });
                    logger.info(`✅ AI Response generated via ${provider}`);
                    return result;
                } else if (provider === 'GEMINI') {
                    const result = await this.askGemini({ systemPrompt, userPrompt, temperature, jsonMode });
                    logger.info(`✅ AI Response generated via ${provider}`);
                    return result;
                }
            } catch (error) {
                logger.warn(`⚠️ ${provider} failed: ${error.message}.`);
                lastError = error;
                // Continue to next provider
            }
        }

        logger.error('❌ All configured AI providers failed.');
        throw new Error(`All AI providers failed. Last error: ${lastError?.message}`);
    }

    async askPerplexity({ systemPrompt, userPrompt, model, temperature, jsonMode }) {
        if (!this.perplexityKey) throw new Error('PERPLEXITY_API_KEY not configured');

        const response = await axios.post(
            this.perplexityUrl,
            {
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt || SystemPrompts.SHOPPING_ASSISTANT },
                    { role: 'user', content: userPrompt }
                ],
                temperature: temperature
            },
            {
                headers: {
                    'Authorization': `Bearer ${this.perplexityKey}`,
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 30000
            }
        );

        const content = response.data.choices[0].message.content;
        return this.parseContent(content, jsonMode);
    }

    async askGemini({ systemPrompt, userPrompt, temperature, jsonMode }) {
        if (!this.geminiKey) throw new Error('GEMINI_API_KEY not configured');

        // Context handling for Gemini (it doesn't have system role in the same way for v1beta in simple mode, but we can prepend)
        // Gemini 1.5 supports system instructions, but for simplicity via REST, we'll prepend.
        const combinedPrompt = `${systemPrompt || ''}\n\n${userPrompt}`;

        const response = await axios.post(
            `${this.geminiUrl}?key=${this.geminiKey}`,
            {
                contents: [{
                    parts: [{ text: combinedPrompt }]
                }],
                generationConfig: {
                    temperature: temperature,
                    // Force JSON for Gemini if requested (MIME type response is supported in newer versions, but keep simple)
                    response_mime_type: jsonMode ? "application/json" : "text/plain"
                }
            },
            {
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000
            }
        );

        // Extract response
        const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!content) throw new Error('Empty response from Gemini');

        return this.parseContent(content, jsonMode);
    }

    parseContent(content, jsonMode) {
        if (jsonMode) {
            try {
                const jsonString = content.replace(/```json/g, '').replace(/```/g, '').trim();
                const firstBrace = jsonString.indexOf('{');
                const lastBrace = jsonString.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1) {
                    return JSON.parse(jsonString.substring(firstBrace, lastBrace + 1));
                }
                return JSON.parse(jsonString);
            } catch (e) {
                logger.warn('Failed to parse JSON from AI response, returning raw.');
            }
        }
        return content;
    }

    /**
     * Analyze a product deal using Perplexity AI
     * @param {Object} product - Product object
     * @returns {Promise<Object>} - { score: number, reason: string }
     */
    async analyzeDeal(product) {
        if (!this.perplexityKey && !this.geminiKey) {
            logger.warn('Skipping AI analysis: No API keys configured');
            return null;
        }

        try {
            const userPrompt = `
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
      `;

            const result = await this.ask({
                systemPrompt: SystemPrompts.ANALYZE_DEAL_JSON,
                userPrompt: userPrompt,
                model: 'sonar',
                temperature: 0.1,
                jsonMode: true
            });

            return {
                score: Math.min(100, Math.max(0, parseInt(result.score) || 50)),
                reason: result.reason || 'AI analysis unavailable'
            };

        } catch (error) {
            logger.error(`AI Analysis failed for ${product.asin}:`, error.message);
            return null;
        }
    }

    /**
     * Answer a user's question with context from their tracked products and global deals
     * @param {string} query - User's question
     * @param {Array} userProducts - List of user's tracked products
     * @param {Array} globalDeals - List of top global deals (optional)
     * @returns {Promise<string>} - AI response
     */
    async answerQuestion(query, userProducts, globalDeals = []) {
        if (!this.perplexityKey && !this.geminiKey) return "I'm sorry, my AI brain is not connected right now (API Key missing).";

        try {
            // Summarize user product context
            const userContext = userProducts.length > 0
                ? userProducts.map(p => `- [Your Tracked] ${p.name.substring(0, 50)}...: EGP ${p.currentPrice} (Score: ${p.smartScore || 'N/A'})`).join('\n')
                : "User is not tracking any products yet.";

            // Summarize global deals context
            const dealsContext = globalDeals.length > 0
                ? globalDeals.map(p => `- [Hot Deal] ${p.name.substring(0, 50)}...: EGP ${p.currentPrice} (${p.discountPercentage?.toFixed(0)}% OFF)`).join('\n')
                : "No specific global deals active right now.";

            const prompt = `
        User's Question: "${query}"
        
        Context:
        ${userContext}
        
        Top Deals in Database:
        ${dealsContext}
        
        Answer the question based on the context and your general knowledge.
        - If the user asks for recommendations, prioritize the "Top Deals" or "Your Tracked" items if relevant.
        - If the user asks about a specific product they track, give detailed advice.
        - If the user asks for something not in the list, use your general knowledge to suggest what to look for or search online.
        
        Keep the answer concise (max 3-4 sentences) and helpful. Use emojis.
      `;

            return await this.ask({
                systemPrompt: SystemPrompts.SHOPPING_ASSISTANT,
                userPrompt: prompt,
                model: 'sonar'
            });

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
        if (!this.perplexityKey && !this.geminiKey) return { category: 'Uncategorized', tags: [] };

        try {
            const prompt = `
        Categorize this product for an e-commerce dashboard.
        Product: "${name}"
        
        Return JSON object with "category" and "tags" (array).
      `;

            // Using Generic JSON prompt structure implicitly via ask if needed, 
            // but here we can just use a simple inline system prompt or add a specialized one.
            // For now, let's reuse a simple system prompt or define one inline since it wasn't in the main list
            // actually let's stick to the pattern.

            return await this.ask({
                systemPrompt: `You are a helpful assistant. ${SystemPrompts.DATA_EXPORT_INSTRUCTIONS || 'Return valid JSON.'}`,
                // Note: DATA_EXPORT_INSTRUCTIONS isn't exported directly, so I'll just use inline for this minor one
                // OR better, I can assume the generic helper handles JSON mode well enough if I instruct it.
                // Let's rely on the ask method's jsonMode which we improved.
                systemPrompt: "You are a categorization assistant. Return only a JSON object with 'category' and 'tags'.",
                userPrompt: prompt,
                model: 'sonar',
                jsonMode: true
            });

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
        if (!this.perplexityKey && !this.geminiKey) return null;

        try {
            const history = product.priceHistory.slice(-10).map(h => h.price).join(', ');

            const prompt = `
        Product: ${product.name}
        Recent Prices (Oldest to Newest): [${history}]
        Current Price: ${product.currentPrice}
      `;

            return await this.ask({
                systemPrompt: SystemPrompts.TREND_PREDICTION_JSON,
                userPrompt: prompt,
                model: 'sonar',
                jsonMode: true
            });

        } catch (error) {
            logger.error('AI Prediction failed:', error.message);
            return null;
        }
    }

    /**
     * Generate a daily summary of the user's portfolio
     * @param {Array} products - List of user's tracked products
     * @returns {Promise<string>} - AI summary
     */
    async generateDailySummary(products) {
        if ((!this.perplexityKey && !this.geminiKey) || products.length === 0) return null;

        try {
            const totalProducts = products.length;
            const priceDrops = products.filter(p => p.priceChange < 0).length;
            const totalSavings = products.reduce((acc, p) => {
                if (p.priceChange < 0) {
                    return acc + (p.oldPrice - p.currentPrice);
                }
                return acc;
            }, 0);

            const productContext = products.slice(0, 10).map(p =>
                `- ${p.name.substring(0, 30)}...: EGP ${p.currentPrice} (${p.priceChange > 0 ? '+' : ''}${p.priceChange}%)`
            ).join('\n');

            const prompt = `
        Portfolio Stats:
        - Total Products: ${totalProducts}
        - Price Drops Today: ${priceDrops}
        - Total Potential Savings: EGP ${totalSavings.toFixed(2)}
        
        Top Items:
        ${productContext}
        
        Write a short, engaging daily summary (max 2-3 sentences). celebrate savings.
      `;

            return await this.ask({
                systemPrompt: SystemPrompts.SHOPPING_ASSISTANT,
                userPrompt: prompt,
                model: 'sonar'
            });
        } catch (error) {
            logger.error('AI Daily Summary failed:', error.message);
            return null;
        }
    }


    /**
     * Check product availability and price using AI (for robust fallback)
     * @param {string} url - Product URL
     * @param {string} [pageContent] - Optional cleaned HTML content (CyberScraper workflow)
     * @returns {Promise<{isAvailable: boolean, price: number | null, currency: string, reason: string}>}
     */
    async checkProductAvailability(url, pageContent = null) {
        if (!this.perplexityKey && !this.geminiKey) {
            logger.warn('Skipping AI availability check: No API keys configured');
            return null;
        }

        try {
            logger.info('🤖 Initiating AI-powered price check...');

            // 1. Stealth Fetch (if content not provided)
            let finalContent = pageContent;
            if (!finalContent) {
                try {
                    logger.debug('🕵️‍♀️ Fetching content via Stealth Scraper...');
                    const rawResult = await getPrice(url, { returnContent: true });
                    // 2. Clean HTML
                    finalContent = cleanHtml(rawResult.content);
                    logger.debug(`✅ Content fetched & cleaned (${finalContent.length} chars)`);
                } catch (fetchError) {
                    logger.warn(`Stealth fetch failed, falling back to URL-only analysis: ${fetchError.message}`);
                }
            }

            let promptContext = `Go to this Amazon URL: ${url}`;

            if (finalContent) {
                promptContext = `
                Analyze the following product page content (from ${url}):
                
                ${finalContent.substring(0, 15000)} // Truncate to avoid token limits
                `;
            }

            return await this.ask({
                systemPrompt: SystemPrompts.AVAILABILITY_CHECK_JSON,
                userPrompt: `${promptContext}\n\nExtract availability and price.`,
                model: 'sonar',
                temperature: 0.1,
                jsonMode: true
            });

        } catch (error) {
            logger.error(`❌ AI Fetch Error: ${error.message}`);
            return null;
        }
    }
}

export const aiService = new AiService();
