import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  console.log('🚀 Trackzoon Bot Starting...');
  
  await app.listen(3000);
  console.log('✅ Trackzoon Bot is running!');
}

bootstrap();
