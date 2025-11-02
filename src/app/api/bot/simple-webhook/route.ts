import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    console.log('=== SIMPLE WEBHOOK CALLED ===');
    const body = await req.json();
    console.log('Received:', JSON.stringify(body));
    
    const botToken = process.env.BOT_TOKEN;
    const message = body.message;
    
    if (message && message.chat) {
      const chatId = message.chat.id;
      console.log('Sending message to chat:', chatId);
      
      // Send message directly via API
      const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: '✅ Bot is working! This is a direct API call.',
        })
      });
      
      const result = await response.json();
      console.log('Telegram API response:', result);
      
      if (!result.ok) {
        console.error('Telegram API error:', result);
      }
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ ok: true }); // Still return ok to avoid retries
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Simple webhook endpoint' });
}
