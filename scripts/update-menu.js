/**
 * Script to update Telegram bot commands menu
 * Run this script to update the menu without redeploying
 */

import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';

dotenv.config();

const bot = new Telegraf(process.env.BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN);

async function updateBotCommands() {
  try {
    console.log('🔄 Updating Telegram bot commands menu...');
    
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Start the bot' },
      { command: 'help', description: 'Show help and commands' },
      { command: 'add', description: 'Track a new product' },
      { command: 'list', description: 'View your tracked products' },
      { command: 'deals', description: 'See top 5 price drops (24h)' },
      { command: 'report', description: 'Get your daily price report' },
      { command: 'chart', description: 'View price history chart' },
      { command: 'settings', description: 'Manage your preferences' },
      { command: 'removeone', description: 'Stop tracking a product' }
    ]);
    
    console.log('✅ Bot commands menu updated successfully!');
    console.log('\n📋 Commands registered:');
    console.log('  /start - Start the bot');
    console.log('  /help - Show help and commands');
    console.log('  /add - Track a new product');
    console.log('  /list - View your tracked products');
    console.log('  /deals - See top 5 price drops (24h)');
    console.log('  /report - Get your daily price report');
    console.log('  /chart - View price history chart');
    console.log('  /settings - Manage your preferences');
    console.log('  /removeone - Stop tracking a product');
    
    console.log('\n✨ Menu will now appear in Telegram!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to update bot commands:', error);
    process.exit(1);
  }
}

updateBotCommands();
