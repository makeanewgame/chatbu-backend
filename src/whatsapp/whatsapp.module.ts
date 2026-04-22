import { Module } from '@nestjs/common';
import { BotModule } from 'src/bot/bot.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { WhatsAppController } from './whatsapp.controller';
import { WhatsAppService } from './whatsapp.service';

@Module({
    imports: [PrismaModule, BotModule],
    controllers: [WhatsAppController],
    providers: [WhatsAppService],
})
export class WhatsAppModule {}
