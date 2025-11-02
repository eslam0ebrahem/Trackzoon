import cron from 'node-cron';
import { PriceTrackerService } from '../services/priceTrackerService.js';
import User from '../models/User.js';
import Product from '../models/Product.js';
import { buildDailyReportMessage } from '../utils/messageHelper.js';

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

  const sendDailyReports = async () => {
    console.log('Starting daily report generation...');
    const startTime = Date.now();
    
    try {
      // Find all users with daily reports enabled
      const users = await User.find({ 'settings.dailyReport': true });
      console.log(`Sending daily reports to ${users.length} users...`);
      
      let sent = 0;
      let failed = 0;
      
      for (const user of users) {
        try {
          // Get user's tracked products with full details
          const products = await Product.find({ 
            'trackedBy.chatId': parseInt(user.chatId) 
          });
          
          if (products.length === 0) {
            continue; // Skip users with no products
          }
          
          // Build and send report
          const reportMessage = buildDailyReportMessage(
            products.map(p => ({
              ...p.toObject(),
              trackedBy: p.trackedBy.filter(t => t.chatId === parseInt(user.chatId))
            })),
            user.firstName || user.username || 'there'
          );
          
          await bot.telegram.sendMessage(user.chatId, reportMessage, {
            parse_mode: 'MarkdownV2',
            disable_web_page_preview: true
          });
          
          sent++;
        } catch (error) {
          console.error(`Failed to send daily report to user ${user.chatId}:`, error.message);
          failed++;
        }
      }
      
      const duration = (Date.now() - startTime) / 1000;
      console.log(`Daily reports completed in ${duration.toFixed(1)}s:
          - ${sent} reports sent
          - ${failed} failed`);
    } catch (error) {
      console.error('Error in daily report generation:', error);
    }
  };

  // Run price checks every 30 minutes
  cron.schedule('0,30 * * * *', runPriceCheck);

  // Send daily reports at 8:00 AM every day
  cron.schedule('0 8 * * *', sendDailyReports);

  // Run initial check after 1 minute
  setTimeout(runPriceCheck, 60 * 1000);
  
  console.log('Scheduler started:');
  console.log('- Price checks: Every 30 minutes');
  console.log('- Daily reports: Every day at 8:00 AM');
};

export default startScheduler;