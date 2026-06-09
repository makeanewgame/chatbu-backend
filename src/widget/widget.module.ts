import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { BotModule } from '../bot/bot.module';
import { WidgetController } from './widget.controller';
import { WidgetService } from './widget.service';

@Module({
    imports: [PrismaModule, JwtModule, BotModule],
    controllers: [WidgetController],
    providers: [WidgetService],
})
export class WidgetModule { }
