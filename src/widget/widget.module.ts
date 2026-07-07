import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { BotModule } from '../bot/bot.module';
import { MinioClientModule } from '../minio-client/minio-client.module';
import { MailModule } from '../mail/mail.module';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({
    imports: [PrismaModule, JwtModule, BotModule, MinioClientModule, MailModule],
    controllers: [WidgetController],
    providers: [WidgetService],
})
export class WidgetModule { }
