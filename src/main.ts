import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as bodyParser from 'body-parser';
import { join } from 'path';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT');

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Chatbu API')
    .setDescription('The chatbu api description')
    .setVersion('1.0')
    .addTag('chatbu')
    .addBearerAuth()
    .addOAuth2()
    .build();

  app.setGlobalPrefix('api');
  app.use(bodyParser.json({ limit: '20mb' }));
  app.use(bodyParser.urlencoded({ limit: '20mb', extended: true }));
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN'),
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
    optionsSuccessStatus: 204
  });

  const documentFactory = () => SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, documentFactory);

  await app.listen(port || 3001);
  app.useStaticAssets(join(__dirname, '../../', 'public'));

  console.log(`Application is running port: ${port || 3001}`);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
