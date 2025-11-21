import { calculatePriceStats } from './src/utils/priceUtils.js';

const runTest = () => {
    console.log('🧪 Testing Smart Deal Validation...\n');

    // Scenario 1: Fake Deal (Price Spike)
    // Price was 100, spiked to 200, now 150.
    // 24h drop: 200 -> 150 (Looks like 25% off)
    // 30d Avg: ~100
    // Result should be: INVALID (150 > 105)
    const fakeDealHistory = [
        { price: 150, date: new Date() }, // Current
        { price: 200, date: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // Yesterday
        ...Array(28).fill(0).map((_, i) => ({
            price: 100,
            date: new Date(Date.now() - (i + 2) * 24 * 60 * 60 * 1000)
        }))
    ];

    const stats1 = calculatePriceStats(fakeDealHistory, 30);
    const currentPrice1 = 150;
    const isFakeDeal = currentPrice1 > stats1.average * 1.05;

    console.log('Scenario 1: Fake Deal (Spike 100 -> 200 -> 150)');
    console.log(`Average Price: ${stats1.average.toFixed(2)}`);
    console.log(`Current Price: ${currentPrice1}`);
    console.log(`Is Fake Deal? ${isFakeDeal ? '✅ YES (Correctly Filtered)' : '❌ NO (Failed)'}`);
    console.log('-'.repeat(40));

    // Scenario 2: Real Deal
    // Price was 100, now 80.
    // 24h drop: 100 -> 80 (20% off)
    // 30d Avg: ~100
    // Result should be: VALID (80 < 105)
    const realDealHistory = [
        { price: 80, date: new Date() }, // Current
        ...Array(29).fill(0).map((_, i) => ({
            price: 100,
            date: new Date(Date.now() - (i + 1) * 24 * 60 * 60 * 1000)
        }))
    ];

    const stats2 = calculatePriceStats(realDealHistory, 30);
    const currentPrice2 = 80;
    const isFakeDeal2 = currentPrice2 > stats2.average * 1.05;

    console.log('\nScenario 2: Real Deal (100 -> 80)');
    console.log(`Average Price: ${stats2.average.toFixed(2)}`);
    console.log(`Current Price: ${currentPrice2}`);
    console.log(`Is Fake Deal? ${isFakeDeal2 ? '❌ YES (False Positive)' : '✅ NO (Correctly Accepted)'}`);
    console.log('-'.repeat(40));
};

runTest();
