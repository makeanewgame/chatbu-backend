import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';
import { MinioClientModule } from 'src/minio-client/minio-client.module';
import { EventsModule } from 'src/events/events.module';
import { ChatFlowModule } from 'src/chat-flow/chat-flow.module';
import { PushNotificationModule } from 'src/push-notification/push-notification.module';
import { HandoffModule } from 'src/handoff/handoff.module';

@Module({
  imports: [PrismaModule, HttpModule, JwtModule, SubscriptionModule, MailModule, MinioClientModule, EventsModule, ChatFlowModule, PushNotificationModule, HandoffModule],
  controllers: [BotController],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule { }
