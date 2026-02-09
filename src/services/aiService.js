import axios from 'axios';
import { logger } from '../utils/logger.js';
import { SystemPrompts } from '../utils/prompts.js';
import { getPrice } from '../utils/scraper/getPrice.js';
import { cleanHtml } from '../utils/htmlCleaner.js';
import cache from '../config/cache.js';
import { shouldAllowAiCall, incrementDailyUsage, pauseGlobalAi, isAvailabilityCooldownActive, setAvailabilityCooldown } from '../utils/aiGuard.js';
export class AiService {
    constructor() {
        this.groqKey = process.env.GROQ_API_KEY;
        this.groqUrl = 'https://api.groq.com/openai/v1/chat/completions';
        this.providers = ['GROQ'];
    }

    /**
     * Generic method to call AI with Dynamic Fallback
     * @param {Object} options - { systemPrompt, userPrompt, model, temperature, jsonMode }
     * @returns {Promise<any>} - Parsed JSON or string content
     */
    /**
     * Generic method to call AI (Groq Only)
     * @param {Object} options - { systemPrompt, userPrompt, model, temperature, jsonMode }
     * @returns {Promise<any>} - Parsed JSON or string content
     */
    async ask({ systemPrompt, userPrompt, model = 'llama-3.1-8b-instant', temperature = 0.2, jsonMode = false, tokenEstimate = 1200 }) {
        // Enforce safe model selection if unsupported aliases slip in
        if (model === 'sonar' || model === 'sonar-mini') model = 'llama-3.1-8b-instant';
        if (model === 'sonar-pro') model = 'llama-3.3-70b-versatile';

        try {
            const allowance = await shouldAllowAiCall({ tokenEstimate });
            if (!allowance.allowed) {
                throw new Error(`AI disabled: ${allowance.reason}`);
            }
            return await this.askGroq({ systemPrompt, userPrompt, temperature, jsonMode, model, tokenEstimate });
        } catch (error) {
            logger.error(`❌ Groq failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Rate Limiter for Groq (Simple 2s interval to spread TPM)
     */
    async throttleGroq() {
        // Simple local sleep for now, as Groq is fast but TPM is the bottleneck.
        // 2000ms ensures we don't burst more than 30 req/min, which combined with 1k tokens/req = 30k TPM (still high).
        // The Free limit is 6000 TPM. So max 6 req/min if each is 1k tokens.
        // Let's set interval to 10000ms (6 RPM) to be 100% safe for 6000 TPM.
        const minInterval = 10000;

        await new Promise(resolve => setTimeout(resolve, 2000)); // Fixed small delay for jitter

        // Use Redis if available for global coordination
        const redis = cache.getClient();
        if (redis && cache.isEnabled()) {
            const key = 'groq:rate_limit_lock';
            while (true) {
                const ttl = await redis.pttl(key);
                if (ttl > 0) {
                    await new Promise(r => setTimeout(r, ttl + 100));
                    continue;
                }
                const result = await redis.set(key, '1', 'PX', minInterval, 'NX');
                if (result === 'OK') return;
                await new Promise(r => setTimeout(r, 200));
            }
        }
    }

    async askGroq({ systemPrompt, userPrompt, temperature, jsonMode, model, tokenEstimate = 1200 }) {
        if (!this.groqKey) throw new Error('GROQ_API_KEY not configured');

        // Default to fast model if not specified, but usually passed by caller
        const finalModel = model === 'sonar' || model === 'sonar-mini'
            ? 'llama-3.1-8b-instant'
            : model === 'sonar-pro'
                ? 'llama-3.3-70b-versatile'
                : (model || 'llama-3.1-8b-instant');

        try {
            await this.throttleGroq();

            const response = await axios.post(
                this.groqUrl,
                {
                    model: finalModel,
                    messages: [
                        { role: 'system', content: systemPrompt || SystemPrompts.SHOPPING_ASSISTANT },
                        { role: 'user', content: userPrompt }
                    ],
                    temperature: temperature,
                    response_format: jsonMode ? { type: "json_object" } : undefined
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.groqKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 20000 // Groq is fast, timeout can be shorter
                }
            );

            const usageTokens = response.data?.usage?.total_tokens;
            await incrementDailyUsage({
                tokens: Number.isFinite(usageTokens) ? usageTokens : tokenEstimate,
                requests: 1
            });

            const content = response.data.choices[0].message.content;
            return this.parseContent(content, jsonMode);

        } catch (error) {
            if (error.response?.status === 429 || String(error.message || '').includes('Rate limit')) {
                const retrySeconds = this.parseRetrySeconds(error.response?.data?.error?.message || error.message);
                await pauseGlobalAi(retrySeconds || 300, 'rate_limit');
            }
            logger.warn(`Groq Error: ${error.response?.data?.error?.message || error.message}`);
            throw error;
        }
    }

    parseRetrySeconds(message = '') {
        const lower = String(message).toLowerCase();
        const matchMinute = lower.match(/in\s+(\d+)m(\d+(\.\d+)?)s/);
        if (matchMinute) {
            const minutes = Number(matchMinute[1] || 0);
            const seconds = Number(matchMinute[2] || 0);
            return Math.ceil(minutes * 60 + seconds);
        }
        const matchSeconds = lower.match(/in\s+(\d+(\.\d+)?)s/);
        if (matchSeconds) {
            return Math.ceil(Number(matchSeconds[1]));
        }
        return null;
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
        if (!this.groqKey) {
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
                model: 'llama-3.3-70b-versatile',
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
        if (!this.groqKey) return "I'm sorry, my AI brain is not connected right now (API Key missing).";

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
        if (!this.groqKey) return { category: 'Uncategorized', tags: [] };

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
                model: 'llama-3.1-8b-instant',
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
        if (!this.groqKey) return null;

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
                model: 'llama-3.3-70b-versatile',
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
        if (!this.groqKey || products.length === 0) return null;

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
    async checkProductAvailability(url, pageContent = null, meta = {}) {
        if (!this.groqKey) {
            logger.warn('Skipping AI availability check: No API keys configured');
            return null;
        }

        const allowance = await shouldAllowAiCall({ tokenEstimate: 1600 });
        if (!allowance.allowed) {
            logger.warn(`Skipping AI availability check (${allowance.reason})`);
            return null;
        }

        const asin = meta.asin;
        if (asin && !meta.skipCooldown) {
            const cooldownActive = await isAvailabilityCooldownActive(asin, url);
            if (cooldownActive) {
                logger.info(`Skipping AI availability check for ${asin} (cooldown active)`);
                return null;
            }
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
                
                ${finalContent.substring(0, 4500)} // Truncated to ~1k tokens to respect Groq/Gemini TPM limits
                `;
            }

            const result = await this.ask({
                systemPrompt: SystemPrompts.AVAILABILITY_CHECK_JSON,
                userPrompt: `${promptContext}\n\nExtract availability and price.`,
                model: 'llama-3.1-8b-instant',
                temperature: 0.1,
                jsonMode: true,
                tokenEstimate: 1600
            });

            if (asin && result && result.isAvailable === false) {
                await setAvailabilityCooldown(asin, url, 6 * 60 * 60);
            }

            return result;

        } catch (error) {
            if (asin) {
                await setAvailabilityCooldown(asin, url, 2 * 60 * 60);
            }
            logger.error(`❌ AI Fetch Error: ${error.message}`);
            return null;
        }
    }
}

export const aiService = new AiService();
