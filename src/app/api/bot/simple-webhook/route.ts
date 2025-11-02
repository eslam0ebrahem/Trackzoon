import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';

// MongoDB connection
async function connectDB() {
  if (mongoose.connection.readyState >= 1) return;
  try {
    await mongoose.connect(process.env.MONGODB_URI || '');
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
  }
}

// Import models
const getUserModel = async () => (await import('@/lib/models/User')).default;
const getProductModel = async () => (await import('@/lib/models/Product')).default;

// Send message helper
async function sendMessage(chatId: number, text: string, options: any = {}) {
  const botToken = process.env.BOT_TOKEN;
  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'MarkdownV2',
      ...options
    })
  });
  return response.json();
}

// Escape markdown
function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Main keyboard
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: '📋 My Products' }, { text: '➕ Add Product' }],
      [{ text: '⚙️ Settings' }, { text: '❓ Help' }]
    ],
    resize_keyboard: true
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = body.message;
    
    if (!message || !message.chat) {
      return NextResponse.json({ ok: true });
    }
    
    await connectDB();
    const chatId = message.chat.id;
    const text = message.text || '';
    const username = message.from?.first_name || message.from?.username || 'there';
    
    // Handle commands
    if (text === '/start') {
      const User = await getUserModel();
      await User.findOneAndUpdate(
        { chatId: String(chatId) },
        { chatId: String(chatId) },
        { upsert: true, new: true }
      );
      
      const welcomeMessage = `👋 *Welcome ${esc(username)}\\!*

I'm your personal Amazon price tracker\\. I'll help you save money by tracking product prices and notifying you when they drop\\!

🌟 *What I can do:*
• Track Amazon product prices 24/7
• Send instant alerts when prices drop
• Show price history and trends
• Help you find the best time to buy

🚀 *Quick Start:*
Just send me any Amazon product link to start tracking\\!

Or use the menu below to explore more options\\.`;

      await sendMessage(chatId, welcomeMessage, mainKeyboard);
    }
    else if (text === '/help' || text === '❓ Help') {
      const helpMessage = `📚 *Help \\& Commands*

🎯 *Quick Actions:*
• Just send me an Amazon link to start tracking\\!
• Use buttons below for easy navigation

📝 *Available Commands:*

*Basic:*
/start \\- Restart the bot
/help \\- Show this help
/list \\- View all tracked products

*Product Management:*
/add <URL> <price> \\- Track a product
   Example: \`/add https://amzn\\.to/xxx 99\\.99\`

💡 *Pro Tips:*
• Set realistic price alerts
• Check /list daily for deals
• Products are checked automatically
• You get instant notifications`;

      await sendMessage(chatId, helpMessage, mainKeyboard);
    }
    else if (text === '/list' || text === '📋 My Products') {
      const Product = await getProductModel();
      const products = await Product.find({ 'trackedBy.chatId': chatId });

      if (products.length === 0) {
        await sendMessage(chatId, 
          '📭 *No Products Yet*\n\nYou haven\'t added any products to track\\.\n\nSend me an Amazon product link to get started\\!',
          mainKeyboard
        );
      } else {
        let msg = `📦 *Your Tracked Products* \\(${products.length}\\)\n\n`;
        
        products.forEach((product: any, index: number) => {
          const tracker = product.trackedBy.find((t: any) => t.chatId === chatId);
          const price = product.currentPrice || 0;
          const threshold = tracker?.thresholdPrice || 0;
          
          msg += `${index + 1}\\. [${esc(product.name.substring(0, 40))}](${esc(product.url)})\n`;
          msg += `   💰 Current: £${esc(price.toFixed(2))} \\| 🎯 Alert: £${esc(threshold.toFixed(2))}\n`;
          if (price > 0 && price <= threshold) msg += `   🎉 *Price is below target\\!*\n`;
          msg += '\n';
        });

        await sendMessage(chatId, msg, { ...mainKeyboard, link_preview_options: { is_disabled: true } });
      }
    }
    else if (text.match(/amazon\.|amzn\./i)) {
      await sendMessage(chatId, '📝 Great\\! Now send me your target price\\.\n\nExample: `99\\.99`', {});
    }
    else if (text === '➕ Add Product') {
      await sendMessage(chatId, 'Send me an Amazon product URL to track\\!', mainKeyboard);
    }
    else {
      await sendMessage(chatId, 'I don\'t understand that\\. Use /help to see available commands\\.', mainKeyboard);
    }
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Bot webhook endpoint (Direct API)' });
}
