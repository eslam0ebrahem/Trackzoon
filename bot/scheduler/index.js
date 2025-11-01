import cron from 'node-cron';
import { updateAllProductPrices } from '../../src/lib/priceUpdater.js';

const startScheduler = (bot) => {
  cron.schedule('0,30 * * * *', async () => {
    console.log('Running scheduled price update...');
    await updateAllProductPrices(bot);
  });
};

export default startScheduler;