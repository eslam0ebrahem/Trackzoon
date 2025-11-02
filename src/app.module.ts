import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { TelegrafModule } from 'nestjs-telegraf';
import { BotModule } from './bot/bot.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.bot', '.env.production'],
    }),
    MongooseModule.forRoot(process.env.MONGODB_URI || '', {
      dbName: 'trackzoon',
    }),
    TelegrafModule.forRoot({
      token: process.env.BOT_TOKEN || '',
    }),
    ScheduleModule.forRoot(),
    BotModule,
  ],
})
export class AppModule {}
