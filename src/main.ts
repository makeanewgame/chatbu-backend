import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';

import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT');

  app.setGlobalPrefix('api');

  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    credentials: true,
  });


  await app.listen(port || 3001);
  app.useStaticAssets(join(__dirname, '../../', 'public'));

  console.log(`Application is running port: ${port || 3001}`);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
