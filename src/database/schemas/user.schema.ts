import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ _id: false })
export class UserSettings {
  @Prop({ default: true })
  notifications: boolean;

  @Prop({ default: false })
  dailyReport: boolean;

  @Prop({ default: 'UTC' })
  timezone: string;

  @Prop({ default: 'EGP' })
  currency: string;

  @Prop({ default: 'en' })
  language: string;
}

const UserSettingsSchema = SchemaFactory.createForClass(UserSettings);

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  chatId: string;

  @Prop()
  username: string;

  @Prop()
  firstName: string;

  @Prop()
  lastName: string;

  @Prop({ type: UserSettingsSchema, default: () => ({}) })
  settings: UserSettings;

  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: 'Product' }] })
  products: MongooseSchema.Types.ObjectId[];

  @Prop({ default: Date.now })
  lastActive: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Update lastActive timestamp before save
UserSchema.pre('save', function (next) {
  this.lastActive = new Date();
  next();
});
