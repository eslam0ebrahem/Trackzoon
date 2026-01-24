import 'dotenv/config';
import { aiService } from '../services/aiService.js';
import { marketIntelligenceService } from '../services/marketIntelligenceService.js';
import { logger } from '../utils/logger.js';

async function runVerification() {
    console.log('🚀 Starting AI Verification...');

    // 1. Verify Generic AI Question
    console.log('\n--- 1. Testing Generic AI Q&A ---');
    try {
        const answer = await aiService.answerQuestion(
            "What factors should I consider when buying a gaming monitor?",
            [],
            []
        );
        console.log('✅ Q&A Answer:', answer.substring(0, 200) + '...');
    } catch (error) {
        console.error('❌ Q&A Failed:', error.message);
    }

    // 2. Verify Market Intelligence Search
    console.log('\n--- 2. Testing Market Intelligence Search ---');
    try {
        const searchResult = await marketIntelligenceService.searchProduct("best budget noise canceling headphones under 2000 EGP");
        console.log('✅ Search Summary:', searchResult.summary);
        console.log('✅ Found Products:', searchResult.products?.length);
        if (searchResult.products?.length > 0) {
            console.log('   Sample:', searchResult.products[0]);
        }
    } catch (error) {
        console.error('❌ Search Failed:', error.message);
    }

    console.log('\n--- Verification Complete ---');
    process.exit(0);
}

runVerification();
