import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BotModule } from 'src/bot/bot.module';
import { IntegrationModule } from 'src/integration/integration.module';
import { IntegrationScheduleModule } from 'src/integration/integration-schedule.module';
import { PrismaModule } from 'src/prisma/prisma.module';
import { MetaChatCursorModule } from 'src/meta-chat-cursor/meta-chat-cursor.module';
import { AudioTranscriptionModule } from 'src/audio-transcription/audio-transcription.module';
import { MetaLoopGuardModule } from 'src/meta-loop-guard/meta-loop-guard.module';
import { MetaAiDisclosureModule } from 'src/meta-ai-disclosure/meta-ai-disclosure.module';
import { MetaWhatsappController } from './meta-whatsapp.controller';
import { MetaWhatsappService } from './meta-whatsapp.service';
import { EventsModule } from 'src/events/events.module';

@Module({
    imports: [ConfigModule, IntegrationModule, IntegrationScheduleModule, BotModule, PrismaModule, MetaChatCursorModule, AudioTranscriptionModule, MetaLoopGuardModule, MetaAiDisclosureModule, EventsModule],
    controllers: [MetaWhatsappController],
    providers: [MetaWhatsappService],
    exports: [MetaWhatsappService],
})
export class MetaWhatsappModule { }
