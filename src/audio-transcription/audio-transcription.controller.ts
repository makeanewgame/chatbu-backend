import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { InternalApiKeyGuard } from '../integration/google-calendar/internal-api-key.guard';
import {
  AudioTranscriptionService,
  VoiceChannel,
} from './audio-transcription.service';

/**
 * Internal smoke-test surface for the audio transcription service.
 * Not called from any client flow — kanal handlers (Slice B) and the
 * widget endpoint (Slice C) inject the service directly. Exists so an
 * operator can `curl` a sample voice note through the full pipeline
 * (multipart -> ffmpeg -> AWS Transcribe -> transcript) with just the
 * internal API key, without going through Meta / MediaRecorder.
 */
@ApiTags('internal')
@Controller('internal/audio-transcribe')
@UseGuards(InternalApiKeyGuard)
export class AudioTranscriptionController {
  constructor(
    private readonly audioTranscription: AudioTranscriptionService,
  ) {}

  @ApiOperation({ summary: 'Smoke-test: transcribe a single audio blob' })
  @Post()
  @UseInterceptors(FileInterceptor('audio'))
  async smokeTranscribe(
    @UploadedFile() file: Express.Multer.File,
    @Body('lang') lang: string,
    @Body('botId') botId: string,
    @Body('teamId') teamId: string,
    @Body('chatId') chatId: string,
  ) {
    if (!file) {
      throw new BadRequestException({ error: 'audio_field_required' });
    }
    return this.audioTranscription.transcribe({
      audio: file.buffer,
      mimeType: file.mimetype,
      languageCode: lang,
      channel: 'internal_smoke' as VoiceChannel,
      tenantContext: {
        botId: botId || 'smoke',
        teamId: teamId || 'smoke',
        chatId: chatId || 'smoke',
      },
    });
  }
}
