import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    const botToken = process.env.BOT_TOKEN;
    
    if (!botToken) {
      return NextResponse.json({ error: 'BOT_TOKEN not set' });
    }
    
    // Test the bot token
    const response = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const data = await response.json();
    
    return NextResponse.json({
      tokenExists: !!botToken,
      tokenLength: botToken.length,
      tokenStart: botToken.substring(0, 10) + '...',
      telegramResponse: data
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) });
  }
}
