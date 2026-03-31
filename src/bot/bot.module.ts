import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { ActionsModule } from 'src/actions/actions.module';

@Module({
  imports: [PrismaModule, HttpModule, JwtModule, SubscriptionModule, MailModule, MinioClientModule, ActionsModule],
  controllers: [BotController],
  providers: [BotService]
})
export class BotModule { }
