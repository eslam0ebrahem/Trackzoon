import { Update, Ctx, Start, Help, Command, On, Action } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { UserService } from '../services/user.service';
import { ProductService } from '../services/product.service';
import { ScraperService } from '../services/scraper.service';
import { Markup } from 'telegraf';
import { Messages } from './utils/messages';

@Update()
export class BotUpdate {
  constructor(
    private readonly userService: UserService,
    private readonly productService: ProductService,
    private readonly scraperService: ScraperService,
  ) {}

  @Start()
  async onStart(@Ctx() ctx: Context) {
    const username = ctx.from?.first_name || ctx.from?.username || 'User';
    const chatId = ctx.chat?.id.toString();

    // Register or get user
    await this.userService.getOrCreateUser(chatId, username);

    await ctx.reply(Messages.welcome(username), {
      parse_mode: 'Markdown',
      ...this.getMainKeyboard(),
    });
  }

  @Help()
  async onHelp(@Ctx() ctx: Context) {
    await ctx.reply(Messages.help, {
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
        await ctx.reply(Messages.noTrackedProducts, {
          parse_mode: 'Markdown',
          ...this.getMainKeyboard(),
        });
        return;
      }

      let message = `📦 *Your Tracked Products* (${products.length})\n\n`;
      
      for (const product of products) {
        const trackedByUser = product.trackedBy.find((t: any) => t.chatId === chatId);
        const threshold = trackedByUser?.thresholdPrice || 0;
        
        message += `🔹 *${product.name}*\n`;
        message += `   💰 Current: £${product.currentPrice.toFixed(2)}\n`;
        message += `   🎯 Target: £${threshold > 0 ? threshold.toFixed(2) : 'Not set'}\n`;
        message += `   🔗 ASIN: \`${product.asin}\`\n\n`;
      }

      await ctx.reply(message, { 
        parse_mode: 'Markdown',
        ...this.getMainKeyboard(),
      });
    } catch (error) {
      await ctx.reply(Messages.errors.general, { parse_mode: 'Markdown' });
    }
  }

  @Command('add')
  async onAddCommand(@Ctx() ctx: Context) {
    await ctx.reply(Messages.addProduct, {
      parse_mode: 'Markdown',
      ...this.getMainKeyboard(),
    });
  }

  @On('text')
  async onText(@Ctx() ctx: Context) {
    const text = (ctx as any).message?.text;
    
    if (!text || text.startsWith('/')) return;

    // Check if it's an Amazon URL
    if (this.isAmazonUrl(text)) {
      await this.handleAmazonUrl(ctx, text);
    } else {
      await ctx.reply(Messages.errors.invalidUrl, { 
        parse_mode: 'Markdown',
        ...this.getMainKeyboard(),
      });
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
      await ctx.reply(Messages.processing.url);

      const chatId = ctx.chat?.id.toString();
      
      // Extract ASIN from URL
      const asin = this.extractAsin(url);
      if (!asin) {
        await ctx.reply(Messages.errors.invalidUrl, { parse_mode: 'Markdown' });
        return;
      }

      // Check if already tracking
      const existing = await this.productService.findByAsin(asin);
      if (existing && existing.trackedBy.some((t: any) => t.chatId === chatId)) {
        await ctx.reply(Messages.errors.alreadyTracking, { parse_mode: 'Markdown' });
        return;
      }

      // Scrape product details
      const productName = await this.scraperService.getProductName(url);
      const currentPrice = await this.scraperService.getPrice(url);

      if (!productName || !currentPrice) {
        await ctx.reply(Messages.errors.scrapingError, { parse_mode: 'Markdown' });
        return;
      }

      await ctx.reply(Messages.processing.tracking);

      // Add product with default threshold (10% discount)
      const thresholdPrice = currentPrice * 0.9;
      await this.productService.addProduct({
        asin,
        url,
        name: productName,
        currentPrice,
        chatId,
        thresholdPrice,
      });

      const difference = ((currentPrice - thresholdPrice) / thresholdPrice) * 100;
      await ctx.reply(
        Messages.productAdded({ name: productName, currentPrice, url }, thresholdPrice, difference),
        { parse_mode: 'Markdown', ...this.getMainKeyboard() }
      );
    } catch (error) {
      console.error('Error handling Amazon URL:', error);
      await ctx.reply(Messages.errors.general, { parse_mode: 'Markdown' });
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

  private getMainKeyboard() {
    return {
      reply_markup: {
        keyboard: [
          [{ text: Messages.addCommand }, { text: Messages.listCommand }],
          [{ text: Messages.helpCommand }],
        ],
        resize_keyboard: true,
      },
    };
  }
}
