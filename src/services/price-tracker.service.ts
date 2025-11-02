import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ProductService } from './product.service';
import { ScraperService } from './scraper.service';
import { InjectBot } from 'nestjs-telegraf';
import { Telegraf } from 'telegraf';

@Injectable()
export class PriceTrackerService {
  private readonly logger = new Logger(PriceTrackerService.name);

  constructor(
    private readonly productService: ProductService,
    private readonly scraperService: ScraperService,
    @InjectBot() private readonly bot: Telegraf,
  ) {}

  // Run price checks every 30 minutes
  @Cron('*/30 * * * *')
  async checkPrices() {
    this.logger.log('🔍 Starting scheduled price check...');

    try {
      const products = await this.productService.getAllProducts();
      this.logger.log(`Found ${products.length} products to check`);

      for (const product of products) {
        await this.checkProductPrice(product);
        // Add delay to avoid rate limiting
        await this.delay(2000);
      }

      this.logger.log('✅ Price check completed');
    } catch (error) {
      this.logger.error('❌ Error during price check:', error);
    }
  }

  private async checkProductPrice(product: any) {
    try {
      const newPrice = await this.scraperService.getPrice(product.url);

      if (!newPrice) {
        this.logger.warn(`Could not fetch price for ${product.name}`);
        return;
      }

      const oldPrice = product.currentPrice;
      await this.productService.updatePrice(product.asin, newPrice);

      // Check if price dropped and notify users
      if (newPrice < oldPrice) {
        this.logger.log(
          `📉 Price drop detected: ${product.name} - $${oldPrice} → $${newPrice}`,
        );
        await this.notifyPriceDrop(product, oldPrice, newPrice);
      }
    } catch (error) {
      this.logger.error(`Error checking price for ${product.asin}:`, error.message);
    }
  }

  private async notifyPriceDrop(product: any, oldPrice: number, newPrice: number) {
    const priceDropPercent = (((oldPrice - newPrice) / oldPrice) * 100).toFixed(1);

    for (const tracker of product.trackedBy) {
      try {
        // Check if price meets threshold
        if (tracker.thresholdPrice && newPrice > tracker.thresholdPrice) {
          continue;
        }

        const message = `🎉 *Price Drop Alert!*

📦 ${product.name}

💰 Old Price: $${oldPrice.toFixed(2)}
✨ New Price: $${newPrice.toFixed(2)}
📉 You save: $${(oldPrice - newPrice).toFixed(2)} (${priceDropPercent}%)

🔗 [View Product](${product.url})`;

        await this.bot.telegram.sendMessage(tracker.chatId, message, {
          parse_mode: 'Markdown',
        });

        this.logger.log(`✅ Notified user ${tracker.chatId} about ${product.name}`);
      } catch (error) {
        this.logger.error(`Failed to notify user ${tracker.chatId}:`, error.message);
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
