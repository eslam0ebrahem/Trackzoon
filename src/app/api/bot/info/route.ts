import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function GET(req: NextRequest) {
  try {
    const bot = new Telegraf(process.env.BOT_TOKEN || '');
    
    // Get current webhook info
    const webhookInfo = await bot.telegram.getWebhookInfo();
    
    // Also get bot info
    const botInfo = await bot.telegram.getMe();

    return NextResponse.json({
      success: true,
      webhookInfo,
      botInfo
    });
  } catch (error) {
    console.error('Error getting info:', error);
    return NextResponse.json(
      { error: 'Failed to get info', details: String(error) },
      { status: 500 }
    );
  }
}
