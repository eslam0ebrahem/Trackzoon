import cron from 'node-cron';
import { PriceTrackerService } from '../services/priceTrackerService.js';

const startScheduler = (bot) => {
  const priceTracker = new PriceTrackerService(bot);
  let isChecking = false;

  const runPriceCheck = async () => {
    if (isChecking) {
      console.log('Previous price check still running, skipping...');
      return;
    }

    isChecking = true;
    console.log('Starting scheduled price check...');
    const startTime = Date.now();

    try {
      const results = await priceTracker.checkAllPrices();
      const duration = (Date.now() - startTime) / 1000;
      
      console.log(`Price check completed in ${duration.toFixed(1)}s:
          - ${results.succeeded} prices updated
          - ${results.unchanged} prices unchanged
          - ${results.failed} checks failed`);
    } catch (error) {
      console.error('Error in scheduled price check:', error);
    } finally {
      isChecking = false;
    }
  };

  // Run price checks every 30 minutes
  cron.schedule('0,30 * * * *', runPriceCheck);

  // Run initial check after 1 minute
  setTimeout(runPriceCheck, 60 * 1000);
};

export default startScheduler;