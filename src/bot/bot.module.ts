import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from '../database/schemas/user.schema';
import { Product, ProductSchema } from '../database/schemas/product.schema';
import { BotUpdate } from './bot.update';
import { UserService } from '../services/user.service';
import { ProductService } from '../services/product.service';
import { PriceTrackerService } from '../services/price-tracker.service';
import { ScraperService } from '../services/scraper.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
    ]),
  ],
  providers: [
    BotUpdate,
    UserService,
    ProductService,
    PriceTrackerService,
    ScraperService,
  ],
})
export class BotModule {}
