import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product } from '../database/schemas/product.schema';

@Injectable()
export class ProductService {
  constructor(@InjectModel(Product.name) private productModel: Model<Product>) {}

  async addProduct(data: {
    asin: string;
    url: string;
    name: string;
    currentPrice: number;
    chatId: string;
    thresholdPrice?: number;
  }): Promise<Product> {
    let product = await this.productModel.findOne({ asin: data.asin });

    if (product) {
      // Add user to trackedBy
      const exists = product.trackedBy.some((t) => t.chatId === parseInt(data.chatId));
      if (!exists) {
        product.trackedBy.push({
          chatId: parseInt(data.chatId),
          thresholdPrice: data.thresholdPrice,
          alertType: 'drop',
          lastAlertedAt: undefined,
          percentageThreshold: undefined,
        });
        await product.save();
      }
      return product;
    }

    // Create new product
    product = new this.productModel({
      asin: data.asin,
      url: data.url,
      name: data.name,
      currentPrice: data.currentPrice,
      thresholdPrice: data.thresholdPrice,
      trackedBy: [
        {
          chatId: parseInt(data.chatId),
          thresholdPrice: data.thresholdPrice,
          alertType: 'drop',
        },
      ],
      priceHistory: [
        {
          price: data.currentPrice,
          date: new Date(),
        },
      ],
    });

    await product.save();
    console.log(`✅ Product added: ${data.name} (${data.asin})`);
    return product;
  }

  async findByAsin(asin: string): Promise<Product | null> {
    return this.productModel.findOne({ asin });
  }

  async getUserProducts(chatId: string): Promise<Product[]> {
    return this.productModel.find({
      'trackedBy.chatId': parseInt(chatId),
    });
  }

  async updatePrice(asin: string, newPrice: number): Promise<Product | null> {
    const product = await this.productModel.findOne({ asin });
    if (!product) return null;

    product.currentPrice = newPrice;
    product.lastChecked = new Date();

    // Only update price history if price changed
    if (product.priceHistory.length === 0 || 
        product.priceHistory[product.priceHistory.length - 1].price !== newPrice) {
      product.priceHistory.push({
        price: newPrice,
        date: new Date(),
      });
      product.lastUpdated = new Date();
    }

    await product.save();
    return product;
  }

  async removeUserFromProduct(asin: string, chatId: string): Promise<Product | null> {
    const product = await this.productModel.findOne({ asin });
    if (!product) return null;

    product.trackedBy = product.trackedBy.filter((t) => t.chatId !== parseInt(chatId));

    // If no one is tracking, delete the product
    if (product.trackedBy.length === 0) {
      await this.productModel.deleteOne({ asin });
      console.log(`🗑️ Product deleted (no trackers): ${asin}`);
      return null;
    }

    await product.save();
    return product;
  }

  async getAllProducts(): Promise<Product[]> {
    return this.productModel.find();
  }
}
