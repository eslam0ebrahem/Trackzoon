import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

// Initialize bot with inline handlers for testing
const bot = new Telegraf(process.env.BOT_TOKEN || '');

// Register a simple start command directly
bot.command('start', async (ctx) => {
  await ctx.reply('🎉 Bot is working! This is a test response.');
});

bot.on('text', async (ctx) => {
  await ctx.reply(`You said: ${ctx.message.text}\n\nBot is responding correctly!`);
});

export async function POST(req: NextRequest) {
  try {
    console.log('Test webhook received request');
    
    const body = await req.json();
    console.log('Processing update:', JSON.stringify(body).substring(0, 200));
    
    await bot.handleUpdate(body);
    
    console.log('Test webhook processed successfully');
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Test webhook error:', error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Test Webhook Endpoint',
    status: 'active'
  });
}
