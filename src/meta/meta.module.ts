import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MetaController } from './meta.controller';
import { MetaIntegrationController } from './meta-integration.controller';
import { MetaService } from './meta.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BotModule } from 'src/bot/bot.module';
import { MetaWhatsappModule } from 'src/meta-whatsapp/meta-whatsapp.module';
import { IntegrationModule } from 'src/integration/integration.module';
import { MetaChatCursorModule } from 'src/meta-chat-cursor/meta-chat-cursor.module';
import { AudioTranscriptionModule } from 'src/audio-transcription/audio-transcription.module';

@Module({
    imports: [PrismaModule, BotModule, JwtModule, MetaWhatsappModule, IntegrationModule, MetaChatCursorModule, AudioTranscriptionModule],
    controllers: [MetaController, MetaIntegrationController],
    providers: [MetaService],
})
export class MetaModule { }
