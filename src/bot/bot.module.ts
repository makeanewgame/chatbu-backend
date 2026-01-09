import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotService } from './bot.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { SubscriptionModule } from '../subscription/subscription.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, HttpModule, JwtModule, SubscriptionModule, MailModule],
  controllers: [BotController],
  providers: [BotService]
})
export class BotModule { }
