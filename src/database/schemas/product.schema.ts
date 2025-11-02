import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class TrackedByInfo {
  @Prop({ required: true })
  chatId: number;

  @Prop()
  lastAlertedAt: Date;

  @Prop({ enum: ['drop', 'percentage_drop'], default: 'drop' })
  alertType: string;

  @Prop()
  thresholdPrice: number;

  @Prop()
  percentageThreshold: number;
}

const TrackedByInfoSchema = SchemaFactory.createForClass(TrackedByInfo);

@Schema({ _id: false })
export class PriceHistory {
  @Prop({ required: true })
  price: number;

  @Prop({ default: Date.now })
  date: Date;
}

const PriceHistorySchema = SchemaFactory.createForClass(PriceHistory);

@Schema({ timestamps: true })
export class Product extends Document {
  @Prop({ required: true, index: true })
  asin: string;

  @Prop({ required: true })
  url: string;

  @Prop({ required: true })
  name: string;

  @Prop({ default: 0 })
  currentPrice: number;

  @Prop({ default: Date.now })
  lastChecked: Date;

  @Prop({ default: Date.now })
  lastUpdated: Date;

  @Prop({ type: [TrackedByInfoSchema], default: [] })
  trackedBy: TrackedByInfo[];

  @Prop()
  thresholdPrice: number;

  @Prop({ type: [PriceHistorySchema], default: [] })
  priceHistory: PriceHistory[];
}

export const ProductSchema = SchemaFactory.createForClass(Product);
