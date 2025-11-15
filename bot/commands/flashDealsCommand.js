/**
 * Flash Deals Command Handler
 * Shows current flash deals for user's tracked products
 */

import User from '../models/User.js';
import { getFlashDealStats } from '../services/flashDealDetector.js';
import { sendMessage } from '../utils/messageHelper.js';

export const handleFlashDealsCommand = async (bot, chatId) => {
  try {
    await sendMessage(bot, chatId, '⏳ Scanning for flash deals...');

    const stats = await getFlashDealStats(chatId);

    if (!stats) {
      await sendMessage(bot, chatId, 
        '❌ Unable to fetch flash deal information. Please try again later.'
      );
      return;
    }

    if (stats.activeDeals.length === 0) {
      const message = `
⚡ *Flash Deals*

No active flash deals right now! 😔

💡 *What are Flash Deals?*
Flash deals are products that dropped >20% in price within the last 24 hours. They're rare opportunities!

📊 *Your Stats:*
💰 Historical Savings from Flash Deals: £${stats.historicalSavings.total.toFixed(2)}
📦 Total Flash Deals Caught: ${stats.historicalSavings.history.length}

🔔 *Enable Notifications:*
Go to /settings and enable flash deal alerts to get notified immediately when deals happen!
`;

      await sendMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '⚙️ Enable Alerts', callback_data: 'settings' },
              { text: '📊 Add Products', callback_data: 'add_product' }
            ],
            [
              { text: '🔍 View All Products', callback_data: 'list_products' }
            ]
          ]
        }
      });
      return;
    }

    // Build message for active deals
    let message = `
⚡ *ACTIVE FLASH DEALS!* ⚡

Found ${stats.activeDeals.length} amazing deal${stats.activeDeals.length !== 1 ? 's' : ''} for you!

💰 *Potential Savings:* £${stats.potentialSavings.total.toFixed(2)}

`;

    stats.activeDeals.forEach((dealInfo, index) => {
      const { product, deal } = dealInfo;
      message += `
${index + 1}. 🔥 [${product.name.substring(0, 60)}...](${product.url})

💥 *${deal.dropPercentage}% OFF* in last ${deal.timeFrame} hours!
💰 Was: £${deal.oldPrice.toFixed(2)} → Now: £${deal.newPrice.toFixed(2)}
💎 Save: £${deal.dropAmount.toFixed(2)}

`;
    });

    message += `
⚠️ *Hurry!* Flash deals may expire anytime.

📊 *Your Flash Deal Stats:*
💰 Historical Savings: £${stats.historicalSavings.total.toFixed(2)}
📦 Total Deals Caught: ${stats.historicalSavings.history.length}
`;

    // Create inline keyboard for each deal
    const keyboard = stats.activeDeals.map((dealInfo, index) => ([
      { 
        text: `🛒 Buy Deal #${index + 1}`, 
        url: dealInfo.product.url 
      }
    ]));

    keyboard.push([
      { text: '🔄 Refresh', callback_data: 'flash_deals' },
      { text: '📊 View All', callback_data: 'list_products' }
    ]);

    await sendMessage(bot, chatId, message, {
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    console.error('Error in handleFlashDealsCommand:', error);
    await sendMessage(bot, chatId, '❌ An error occurred while fetching flash deals.');
  }
};

export default handleFlashDealsCommand;
