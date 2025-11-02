import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function GET(req: NextRequest) {
  try {
    const bot = new Telegraf(process.env.BOT_TOKEN || '');
    
    // Delete webhook and drop pending updates
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });

    return NextResponse.json({
      success: true,
      message: 'Webhook deleted and pending updates cleared!'
    });
  } catch (error) {
    console.error('Error deleting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
