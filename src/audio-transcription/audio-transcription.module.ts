import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AudioTranscriptionService } from './audio-transcription.service';
import { AudioTranscriptionController } from './audio-transcription.controller';
import { MetaAudioService } from './meta-audio.service';
import { PrismaModule } from '../prisma/prisma.module';
import {
  chatbuVoiceMessageAudioDurationSeconds,
  chatbuVoiceMessageTranscribeDurationSeconds,
  chatbuVoiceMessageTranscribeTotal,
} from '../prometheus/metrics.providers';

@Module({
  imports: [PrismaModule, PrometheusModule],
  controllers: [AudioTranscriptionController],
  providers: [
    AudioTranscriptionService,
    MetaAudioService,
    chatbuVoiceMessageTranscribeTotal,
    chatbuVoiceMessageTranscribeDurationSeconds,
    chatbuVoiceMessageAudioDurationSeconds,
  ],
  exports: [AudioTranscriptionService, MetaAudioService],
})
export class AudioTranscriptionModule {}
