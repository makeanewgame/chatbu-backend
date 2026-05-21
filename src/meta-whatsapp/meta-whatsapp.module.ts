import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from 'src/bot/bot.module';
import { IntegrationModule } from 'src/integration/integration.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MetaWhatsappController } from './meta-whatsapp.controller';
import { MetaWhatsappService } from './meta-whatsapp.service';

@Module({
    imports: [ConfigModule, IntegrationModule, BotModule, PrismaModule],
    controllers: [MetaWhatsappController],
    providers: [MetaWhatsappService],
    exports: [MetaWhatsappService],
})
export class MetaWhatsappModule { }
