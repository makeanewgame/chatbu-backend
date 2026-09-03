import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { AudioTranscriptionService } from './audio-transcription.service';
import { AudioTranscriptionController } from './audio-transcription.controller';
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
    chatbuVoiceMessageTranscribeTotal,
    chatbuVoiceMessageTranscribeDurationSeconds,
    chatbuVoiceMessageAudioDurationSeconds,
  ],
  exports: [AudioTranscriptionService],
})
export class AudioTranscriptionModule {}
