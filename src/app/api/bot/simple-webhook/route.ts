import { NextRequest, NextResponse } from 'next/server';
import { Telegraf, Markup } from 'telegraf';
import mongoose from 'mongoose';

// Initialize Telegraf bot
const bot = new Telegraf(process.env.BOT_TOKEN || '');

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

// Escape markdown
function esc(text: string): string {
  return text.replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

// Main keyboard
const mainKeyboard = () => Markup.keyboard([
  ['📋 My Products', '➕ Add Product'],
  ['⚙️ Settings', '❓ Help']
]).resize();

// Register bot handlers
bot.command('start', async (ctx) => {
  try {
    await connectDB();
    const User = await getUserModel();
    const username = ctx.from?.first_name || ctx.from?.username || 'there';
    
    await User.findOneAndUpdate(
      { chatId: String(ctx.chat.id) },
      { chatId: String(ctx.chat.id) },
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

    await ctx.reply(welcomeMessage, {
      parse_mode: 'MarkdownV2',
      ...mainKeyboard()
    });
  } catch (error) {
    console.error('Error in start command:', error);
    await ctx.reply('Sorry, something went wrong. Please try again.');
  }
});

bot.command('help', async (ctx) => {
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
• You get instant notifications

❓ Need more help? Just ask\\!`;

  await ctx.reply(helpMessage, {
    parse_mode: 'MarkdownV2',
    ...mainKeyboard()
  });
});

bot.command('list', async (ctx) => {
  try {
    await connectDB();
    const Product = await getProductModel();
    
    const products = await Product.find({
      'trackedBy.chatId': ctx.chat.id
    });

    if (products.length === 0) {
      await ctx.reply(
        '📭 *No Products Yet*\n\nYou haven\'t added any products to track\\.\n\nSend me an Amazon product link to get started\\!',
        { parse_mode: 'MarkdownV2', ...mainKeyboard() }
      );
      return;
    }

    let message = `📦 *Your Tracked Products* \\(${products.length}\\)\n\n`;
    
    products.forEach((product: any, index: number) => {
      const tracker = product.trackedBy.find((t: any) => t.chatId === ctx.chat.id);
      const price = product.currentPrice || 0;
      const threshold = tracker?.thresholdPrice || 0;
      const isBelow = price > 0 && price <= threshold;
      
      message += `${index + 1}\\. [${esc(product.name.substring(0, 40))}](${esc(product.url)})\n`;
      message += `   💰 Current: £${esc(price.toFixed(2))} \\| 🎯 Alert: £${esc(threshold.toFixed(2))}\n`;
      if (isBelow) message += `   🎉 *Price is below your target\\!*\n`;
      message += '\n';
    });

    await ctx.reply(message, {
      parse_mode: 'MarkdownV2',
      link_preview_options: { is_disabled: true },
      ...mainKeyboard()
    });
  } catch (error) {
    console.error('Error in list command:', error);
    await ctx.reply('Sorry, something went wrong fetching your products.');
  }
});

// Handle text messages
bot.on('text', async (ctx) => {
  const text = ctx.message.text;
  
  if (text === '� My Products') {
    // Trigger the list command
    return ctx.reply('/list').catch(() => {});
  } else if (text === '➕ Add Product') {
    await ctx.reply('Send me an Amazon product URL to track\\!', {
      parse_mode: 'MarkdownV2',
      ...mainKeyboard()
    });
  } else if (text === '❓ Help') {
    // Trigger the help command
    return ctx.reply('/help').catch(() => {});
  } else if (text.match(/amazon\.|amzn\./i)) {
    await ctx.reply('📝 Great\\! Now send me your target price\\.\n\nExample: `99\\.99`', {
      parse_mode: 'MarkdownV2'
    });
  } else {
    await ctx.reply('I don\'t understand that\\. Use /help to see available commands\\.', {
      parse_mode: 'MarkdownV2',
      ...mainKeyboard()
    });
  }
});

// Handle errors
bot.catch((err: any) => {
  console.error('Bot error:', err);
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await bot.handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true }); // Return ok to prevent Telegram retries
  }
}

export async function GET() {
  return NextResponse.json({ 
    message: 'Bot webhook endpoint (Telegraf)',
    status: 'active'
  });
}
