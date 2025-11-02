import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

// MongoDB connection
async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Setup bot with handlers
function setupBot() {
  const bot = new Telegraf(process.env.BOT_TOKEN || '');
  
  // Start command
  bot.command('start', async (ctx) => {
    try {
      const username = ctx.from?.first_name || ctx.from?.username || 'there';
      const message = `👋 *Welcome ${username.replace(/[_*\[\]()~`>#+=|{}.!-]/g, '\\$&')}\\!*

I'm your personal Amazon price tracker\\. I'll help you save money by tracking product prices and notifying you when they drop\\!

🌟 *What I can do:*
• Track Amazon product prices 24/7
• Send instant alerts when prices drop
• Show price history and trends
• Help you find the best time to buy

🚀 *Quick Start:*
Just send me any Amazon product link to start tracking\\!

Use /help to see all commands\\.`;

      await ctx.reply(message, {
        parse_mode: 'MarkdownV2'
      });
    } catch (error) {
      console.error('Start command error:', error);
      await ctx.reply('Welcome! Send me an Amazon product link to start tracking prices.');
    }
  });

  // Help command
  bot.command('help', async (ctx) => {
    const helpMessage = `📚 *Help & Commands*

🎯 *Quick Actions:*
• Send me an Amazon link to start tracking\\!
• Use /list to see your tracked products

📝 *Available Commands:*
/start \\- Restart the bot
/help \\- Show this help
/list \\- View all tracked products

💡 Need more help? Just ask\\!`;

    await ctx.reply(helpMessage, { parse_mode: 'MarkdownV2' }).catch(() => {
      ctx.reply('Use /start to begin tracking Amazon products!');
    });
  });

  // List command placeholder
  bot.command('list', async (ctx) => {
    await ctx.reply('📦 Your tracked products will appear here. Use /start to add products!');
  });

  // Catch all
  bot.on('text', async (ctx) => {
    await ctx.reply('👋 Send /start to begin or /help for assistance!');
  });

  return bot;
}

export async function POST(req: NextRequest) {
  let bot;
  try {
    console.log('Webhook received');
    
    // Connect to database
    await connectDB();
    
    // Create bot instance with handlers
    bot = setupBot();
    
    // Parse the update from Telegram
    const body = await req.json();
    console.log('Processing update:', body.update_id);
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 even on error to prevent Telegram from retrying
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Telegram Bot Webhook Endpoint',
    status: 'active' 
  });
}
