import { jest } from '@jest/globals';

jest.unstable_mockModule('axios', () => ({
    default: {
        post: jest.fn()
    }
}));

const { marketIntelligenceService } = await import('../services/marketIntelligenceService.js');
const axios = (await import('axios')).default;

describe('MarketIntelligenceService', () => {
    beforeEach(() => {
        process.env.PERPLEXITY_API_KEY = 'test-key';
        marketIntelligenceService.apiKey = 'test-key';
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('searchProduct should parse JSON response correctly', async () => {
        const mockResponse = {
            data: {
                choices: [
                    {
                        message: {
                            content: `
                            Here is the result:
                            \`\`\`json
                            {
                                "summary": "Great options",
                                "products": [
                                    {
                                        "title": "Test Product",
                                        "price": "1000",
                                        "url": "http://amazon.eg/test",
                                        "reason": "Good value"
                                    }
                                ]
                            }
                            \`\`\`
                            `
                        }
                    }
                ]
            }
        };

        axios.post.mockResolvedValue(mockResponse);

        const result = await marketIntelligenceService.searchProduct('test query');

        expect(result).toEqual({
            summary: "Great options",
            products: [
                {
                    title: "Test Product",
                    price: "1000",
                    url: "http://amazon.eg/test",
                    reason: "Good value"
                }
            ]
        });
    });

    test('comparePrices should handle empty competitors', async () => {
        const mockResponse = {
            data: {
                choices: [
                    {
                        message: {
                            content: JSON.stringify({
                                competitors: [],
                                lowestPrice: 0,
                                lowestPlatform: "None"
                            })
                        }
                    }
                ]
            }
        };

        axios.post.mockResolvedValue(mockResponse);

        const result = await marketIntelligenceService.comparePrices('Unknown Product');

        expect(result.competitors).toEqual([]);
    });
});
