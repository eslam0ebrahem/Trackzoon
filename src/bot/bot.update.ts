import { Update, Ctx, Start, Help, Command, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from '../services/user.service';
import { ProductService } from '../services/product.service';
import { ScraperService } from '../services/scraper.service';
import { Markup } from 'telegraf';

@Update()
export class BotUpdate {
  constructor(
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly scraperService: ScraperService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const username = ctx.from?.first_name || ctx.from?.username || 'there';
    const chatId = ctx.chat?.id.toString();

    // Register or get user
    await this.userService.getOrCreateUser(chatId, username);

    const welcomeMessage = `👋 *Welcome ${this.escapeMarkdown(username)}!*

I'm your personal Amazon price tracker. I'll help you save money by tracking product prices and notifying you when they drop!

🌟 *What I can do:*
• Track Amazon product prices 24/7
• Send instant alerts when prices drop
• Show price history and trends
• Help you find the best time to buy

🚀 *Quick Start:*
Just send me any Amazon product link to start tracking!

Or use the menu below to explore more options...`;

    await ctx.reply(welcomeMessage, {
      parse_mode: 'Markdown',
      ...this.getMainKeyboard(),
    });
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    const helpMessage = `📚 *Help & Commands*

🎯 *Quick Actions:*
• Just send me an Amazon link to start tracking!
• Use buttons below for easy navigation

📝 *Available Commands:*

*Basic:*
/start - Restart the bot
/help - Show this help
/list - View all tracked products
/report - Get your daily price report

*Product Management:*
/add <URL> <price> - Track a product
   Example: \`/add https://amzn.to/xxx 99.99\`
/remove <ASIN> - Stop tracking a product

*Settings:*
/settings - Manage preferences

💡 *Pro Tips:*
• Set realistic price alerts
• Check /list daily for deals
• Enable daily reports in /settings
• Products are checked automatically
• You get instant notifications

❓ Need more help? Just ask!`;

    await ctx.reply(helpMessage, {
      parse_mode: 'Markdown',
      ...this.getMainKeyboard(),
    });
  }

  @Command('list')
  async onList(@Ctx() ctx: Context) {
    try {
      const chatId = ctx.chat?.id.toString();
      const products = await this.productService.getUserProducts(chatId);

      if (!products || products.length === 0) {
        await ctx.reply(
          '📦 *Your Tracking List is Empty*\n\nSend me an Amazon product link to start tracking prices!',
          {
            parse_mode: 'Markdown',
            ...this.getMainKeyboard(),
          },
        );
        return;
      }

      let message = `📦 *Your Tracked Products* (${products.length})\n\n`;
      
      for (const product of products) {
        message += `🔹 *${product.name}*\n`;
        message += `   💰 Current: $${product.currentPrice.toFixed(2)}\n`;
        message += `   🎯 Target: $${product.thresholdPrice?.toFixed(2) || 'Not set'}\n`;
        message += `   🔗 ASIN: \`${product.asin}\`\n\n`;
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });
    } catch (error) {
      await ctx.reply('❌ Error fetching your products. Please try again.');
    }
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const text = (ctx as any).message?.text;
    
    if (!text || text.startsWith('/')) return;

    // Check if it's an Amazon URL
    if (this.isAmazonUrl(text)) {
      await this.handleAmazonUrl(ctx, text);
    } else {
      await ctx.reply(
        '🤔 I can help you track Amazon products!\n\nPlease send me a valid Amazon product link.',
        { ...this.getMainKeyboard() },
      );
    }
  }

  @Action(/track_(.+)/)
  async onTrackProduct(@Ctx() ctx: Context) {
    const action = (ctx as any).callbackQuery?.data;
    const asin = action?.replace('track_', '');

    if (!asin) {
      await ctx.answerCbQuery('Invalid product');
      return;
    }

    await ctx.answerCbQuery('Setting up tracking...');
    await ctx.reply('Please enter your target price for this product:');
    // State management would go here
  }

  private async handleAmazonUrl(ctx: Context, url: string) {
    try {
      await ctx.reply('🔍 Analyzing product...');

      const chatId = ctx.chat?.id.toString();
      
      // Extract ASIN from URL
      const asin = this.extractAsin(url);
      if (!asin) {
        await ctx.reply('❌ Could not extract product ID from URL. Please try another link.');
        return;
      }

      // Check if already tracking
      const existing = await this.productService.findByAsin(asin);
      if (existing) {
        await ctx.reply(
          `✅ You're already tracking this product!\n\n*${existing.name}*\nCurrent price: $${existing.currentPrice}`,
          { parse_mode: 'Markdown' },
        );
        return;
      }

      // Scrape product details
      const productName = await this.scraperService.getProductName(url);
      const currentPrice = await this.scraperService.getPrice(url);

      if (!productName || !currentPrice) {
        await ctx.reply('❌ Could not fetch product details. Please try again later.');
        return;
      }

      await ctx.reply(
        `📦 *Product Found!*\n\n${productName}\n\n💰 Current Price: $${currentPrice}\n\nWhat's your target price?`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            force_reply: true,
          },
        },
      );

      // Store temp data for next step (you'd use a proper state manager here)
      // For now, create the product with a default threshold
      await this.productService.addProduct({
        asin,
        url,
        name: productName,
        currentPrice,
        chatId,
        thresholdPrice: currentPrice * 0.9, // Default 10% discount
      });

      await ctx.reply('✅ Product added to your tracking list!');
    } catch (error) {
      console.error('Error handling Amazon URL:', error);
      await ctx.reply('❌ Something went wrong. Please try again later.');
    }
  }

  private isAmazonUrl(text: string): boolean {
    return /amazon\.(com|eg|ae|sa|uk|de|fr|it|es|ca|com\.au|co\.jp|in|com\.br|com\.mx|cn|nl|se|pl|com\.tr|sg)/.test(
      text,
    );
  }

  private extractAsin(url: string): string | null {
    const match = url.match(/\/dp\/([A-Z0-9]{10})|\/gp\/product\/([A-Z0-9]{10})|\/ASIN\/([A-Z0-9]{10})/i);
    return match ? match[1] || match[2] || match[3] : null;
  }

  private escapeMarkdown(text: string): string {
    return text.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, '\\$&');
  }

  private getMainKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: '📋 My Products' }, { text: '➕ Add Product' }],
          [{ text: '📊 Price Report' }, { text: '⚙️ Settings' }],
          [{ text: '❓ Help' }],
        ],
        resize_keyboard: true,
      },
    };
  }
}
