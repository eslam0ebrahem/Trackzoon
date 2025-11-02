import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../database/schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

  async getOrCreateUser(chatId: string, username?: string): Promise<User> {
    let user = await this.userModel.findOne({ chatId });

    if (!user) {
      user = new this.userModel({
        chatId,
        username,
        firstName: username,
      });
      await user.save();
      console.log(`✅ New user registered: ${chatId}`);
    }

    return user;
  }

  async findByChatId(chatId: string): Promise<User | null> {
    return this.userModel.findOne({ chatId });
  }

  async updateSettings(chatId: string, settings: any): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { chatId },
      { $set: { settings } },
      { new: true },
    );
  }

  async addProduct(chatId: string, productId: string): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { chatId },
      { $addToSet: { products: productId } },
      { new: true },
    );
  }

  async removeProduct(chatId: string, productId: string): Promise<User | null> {
    return this.userModel.findOneAndUpdate(
      { chatId },
      { $pull: { products: productId } },
      { new: true },
    );
  }

  async getAllUsers(): Promise<User[]> {
    return this.userModel.find();
  }
}
