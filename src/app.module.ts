import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthenticationModule } from './authentication/authentication.module';
import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import { CacheModule } from '@nestjs/cache-manager';
import { MailModule } from './mail/mail.module';
import { FileModule } from './file/file.module';
import { MinioClientModule } from './minio-client/minio-client.module';
import { PrismaModule } from './prisma/prisma.module';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    CacheModule.register({ isGlobal: true }),
    WinstonModule.forRoot({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'combined.log' }),
      ],
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }), AuthenticationModule, MailModule, FileModule, MinioClientModule, PrismaModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
