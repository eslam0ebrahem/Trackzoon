import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// Simple MongoDB connection
async function connectDB() {
  if (mongoose.connection.readyState >= 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Import bot handlers
// Note: You may need to adjust these imports based on your bot structure
async function setupBotHandlers() {
  try {
    // Import and register your bot handlers here
    // This is a placeholder - adjust based on your actual bot setup
    // @ts-ignore - Bot handlers are JavaScript files
    const registerHandlers = (await import('../../../../../../bot/handlers.js')).default;
    registerHandlers(bot);
  } catch (error) {
    console.error('Error setting up bot handlers:', error);
  }
}

export async function POST(req: NextRequest) {
  try {
    // Connect to database
    await connectDB();
    
    // Setup bot handlers if not already done
    if (!bot.botInfo) {
      await setupBotHandlers();
    }

    // Parse the update from Telegram
    const body = await req.json();
    
    // Process the update
    await bot.handleUpdate(body);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Telegram Bot Webhook Endpoint',
    status: 'active' 
  });
}
