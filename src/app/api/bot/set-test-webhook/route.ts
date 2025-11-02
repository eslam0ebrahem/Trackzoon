import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

export async function GET(req: NextRequest) {
  try {
    const bot = new Telegraf(process.env.BOT_TOKEN || '');
    const baseUrl = process.env.NEXTAUTH_URL || 'https://trackzon-40obcf827-eslam0ebrahems-projects.vercel.app';
    const webhookUrl = `${baseUrl}/api/bot/test-webhook`;

    // Set the webhook
    await bot.telegram.setWebhook(webhookUrl);
    
    // Get webhook info to verify
    const webhookInfo = await bot.telegram.getWebhookInfo();

    return NextResponse.json({
      success: true,
      message: 'Test webhook set successfully!',
      webhookUrl,
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

export async function POST(req: NextRequest) {
  return GET(req);
}
