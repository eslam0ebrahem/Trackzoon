import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';
import mongoose from 'mongoose';

// Initialize bot
const bot = new Telegraf(process.env.BOT_TOKEN || '');
let botInitialized = false;

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

// Import bot handlers dynamically
async function setupBotHandlers() {
  if (botInitialized) return;
  
  try {
    // Import the handlers module from the bot directory
    const handlersModule = await import('@/../bot/handlers.js');
    const registerHandlers = handlersModule.default;
    
    // Register all handlers
    registerHandlers(bot);
    botInitialized = true;
    console.log('Bot handlers registered successfully');
  } catch (error) {
    console.error('Error setting up bot handlers:', error);
    // Don't throw - allow the bot to work with basic functionality
  }
}

export async function POST(req: NextRequest) {
  try {
    // Connect to database
    await connectDB();
    
    // Setup bot handlers on first request
    await setupBotHandlers();

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
