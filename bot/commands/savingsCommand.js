/**
 * Savings Command Handler
 * Shows user's total savings and breakdown
 */

import User from '../models/User.js';
import { generateSavingsChart } from '../utils/chartGenerator.js';
import { sendMessage } from '../utils/messageHelper.js';

export const handleSavingsCommand = async (bot, chatId) => {
  try {
    const user = await User.findOne({ chatId });

    if (!user) {
      await sendMessage(bot, chatId, 
        '❌ User not found. Use /start to register.'
      );
      return;
    }

    const savings = user.savings || {
      total: 0,
      priceDrops: 0,
      waitedForDeals: 0,
      flashDeals: 0,
      history: []
    };

    if (savings.total === 0) {
      await sendMessage(bot, chatId, 
        '💰 *Your Savings Tracker*\n\n' +
        'You haven\'t saved any money yet!\n\n' +
        '💡 *Tips to save:*\n' +
        '• Set target prices and wait for deals\n' +
        '• Enable flash deal alerts (/settings)\n' +
        '• Track more products to find the best prices\n' +
        '• Check daily reports for hot deals',
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Generate savings breakdown chart
    const savingsBreakdown = {
      'Price Drops': savings.priceDrops || 0,
      'Waited for Deals': savings.waitedForDeals || 0,
      'Flash Deals': savings.flashDeals || 0
    };

    let message = `
💰 *Your Savings Summary*

🎉 *Total Saved:* £${savings.total.toFixed(2)}

📊 *Breakdown:*
💎 Price Drops: £${savings.priceDrops.toFixed(2)}
⏳ Waited for Deals: £${savings.waitedForDeals.toFixed(2)}
⚡ Flash Deals: £${savings.flashDeals.toFixed(2)}

📈 *Statistics:*
📦 Total Deals: ${savings.history?.length || 0}
💵 Average Saving: £${savings.history?.length > 0 ? (savings.total / savings.history.length).toFixed(2) : '0.00'}
`;

    // Show recent savings
    if (savings.history && savings.history.length > 0) {
      const recentSavings = savings.history
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5);

      message += '\n📋 *Recent Savings:*\n';
      recentSavings.forEach((saving, index) => {
        const emoji = saving.type === 'flash_deal' ? '⚡' : 
                     saving.type === 'price_drop' ? '💎' : '⏳';
        const date = new Date(saving.date).toLocaleDateString();
        message += `\n${emoji} £${saving.amount.toFixed(2)} - ${saving.productName.substring(0, 30)}... (${date})`;
      });
    }

    message += '\n\n💡 Keep tracking more products to maximize your savings!';

    // Try to send chart
    try {
      const chartUrl = await generateSavingsChart(savings.total, savingsBreakdown);
      if (chartUrl) {
        await bot.telegram.sendPhoto(chatId, chartUrl, {
          caption: message,
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '📊 View All Products', callback_data: 'list_products' },
                { text: '🔍 Find Deals', callback_data: 'top_deals' }
              ],
              [
                { text: '⚙️ Settings', callback_data: 'settings' },
                { text: '📈 Daily Report', callback_data: 'report' }
              ]
            ]
          }
        });
      } else {
        throw new Error('Chart generation failed');
      }
    } catch (chartError) {
      // Send text-only message if chart fails
      await sendMessage(bot, chatId, message, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 View All Products', callback_data: 'list_products' },
              { text: '🔍 Find Deals', callback_data: 'top_deals' }
            ]
          ]
        }
      });
    }

  } catch (error) {
    console.error('Error in handleSavingsCommand:', error);
    await sendMessage(bot, chatId, '❌ An error occurred while fetching your savings data.');
  }
};

export default handleSavingsCommand;
