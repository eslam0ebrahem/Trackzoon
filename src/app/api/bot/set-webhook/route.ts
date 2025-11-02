import { NextRequest, NextResponse } from 'next/server';
import { Telegraf } from 'telegraf';

// This route is used to set up the Telegram webhook
// Call it once after deployment to configure your bot
export async function GET(req: NextRequest) {
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
      message: 'Webhook set successfully! Your bot is now ready to receive messages.',
      webhookInfo,
      instructions: 'Your bot should now respond to messages on Telegram!'
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
  // Same as GET for convenience
  return GET(req);
}
