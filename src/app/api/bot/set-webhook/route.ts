import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function POST(req: NextRequest) {
  try {
    const bot = new Telegraf(process.env.BOT_TOKEN || '');
    const webhookUrl = process.env.WEBHOOK_URL || '';

    if (!webhookUrl) {
      return NextResponse.json(
        { error: 'WEBHOOK_URL environment variable is not set' },
        { status: 400 }
      );
    }

    // Set the webhook
    await bot.telegram.setWebhook(webhookUrl);
    
    // Get webhook info to verify
    const webhookInfo = await bot.telegram.getWebhookInfo();

    return NextResponse.json({
      success: true,
      message: 'Webhook set successfully',
      webhookInfo
    });
  } catch (error) {
    console.error('Error setting webhook:', error);
    return NextResponse.json(
      { error: 'Failed to set webhook', details: String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const bot = new Telegraf(process.env.BOT_TOKEN || '');
    const webhookInfo = await bot.telegram.getWebhookInfo();

    return NextResponse.json({
      webhookInfo
    });
  } catch (error) {
    console.error('Error getting webhook info:', error);
    return NextResponse.json(
      { error: 'Failed to get webhook info', details: String(error) },
      { status: 500 }
    );
  }
}
