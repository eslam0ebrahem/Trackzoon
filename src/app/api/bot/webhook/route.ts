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
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
}

// Import bot handlers dynamically
async function setupBotHandlers() {
  if (botInitialized) return;
  
  try {
    console.log('Attempting to load bot handlers...');
    
    // Dynamically import all the required modules
    const { default: registerHandlers } = await import('../../../../../bot/handlers.js');
    
    // Register all handlers
    registerHandlers(bot);
    botInitialized = true;
    console.log('Bot handlers registered successfully');
  } catch (error) {
    console.error('Error setting up bot handlers:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));
    
    // Fallback: Register basic handlers if full handlers fail
    if (!botInitialized) {
      bot.command('start', async (ctx) => {
        await ctx.reply('⚠️ Bot is running in basic mode. Full features are loading...');
      });
      bot.on('text', async (ctx) => {
        await ctx.reply('Bot is running but some features may not be available. Please contact support.');
      });
      botInitialized = true;
      console.log('Fallback handlers registered');
    }
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log('Webhook received request');
    
    // Connect to database
    await connectDB();
    console.log('Database connected');
    
    // Setup bot handlers on first request
    await setupBotHandlers();
    console.log('Handlers setup attempted');

    // Parse the update from Telegram
    const body = await req.json();
    console.log('Received update:', JSON.stringify(body).substring(0, 100));
    
    // Process the update
    await bot.handleUpdate(body);
    
    const duration = Date.now() - startTime;
    console.log(`Webhook processed successfully in ${duration}ms`);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`Webhook error after ${duration}ms:`, error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return NextResponse.json(
      { ok: false, error: 'Internal server error', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Telegram Bot Webhook Endpoint',
    status: 'active',
    botInitialized,
    timestamp: new Date().toISOString()
  });
}
