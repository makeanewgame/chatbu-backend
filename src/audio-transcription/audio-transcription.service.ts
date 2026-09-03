import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
} from '@aws-sdk/client-transcribe-streaming';
import ffmpegPath = require('@ffmpeg-installer/ffmpeg');
import ffmpeg = require('fluent-ffmpeg');
import { Readable } from 'stream';
import { PrismaService } from '../prisma/prisma.service';

export type VoiceChannel =
  | 'widget'
  | 'messenger'
  | 'instagram'
  | 'whatsapp'
  | 'wa_test'
  | 'internal_smoke';

export interface AudioTranscribeInput {
  audio: Buffer;
  mimeType: string;
  languageCode?: string;
  channel: VoiceChannel;
  tenantContext: { botId: string; teamId: string; chatId: string };
}

export interface AudioTranscribeOutput {
  transcript: string;
  durationSeconds: number;
  languageDetected: string;
  provider: 'aws-transcribe';
}

// Audio caps — MediaRecorder / Meta both silently truncate anything
// longer, but we defend the pipeline anyway. 2 min * 16kHz * 2 bytes
// (16-bit mono PCM) = 3.84 MB PCM after conversion — well within a
// single Transcribe streaming session's practical envelope.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;   // 5 MB input blob (pre-decode)
const MAX_DURATION_SECONDS = 120;          // 2 min post-decode

// Transcribe streaming wants 16 kHz mono 16-bit PCM for the Turkish
// medical/general vocabulary variants we care about. Higher rates raise
// cost and add no accuracy for Opus voice notes recorded on phones,
// which are already band-limited around 8 kHz.
const PCM_SAMPLE_RATE = 16000;
const PCM_BYTES_PER_SAMPLE = 2;
const PCM_CHANNELS = 1;

// Chunk the PCM buffer for the streaming API. 200 ms of audio per
// chunk lets the service start returning partial results almost
// immediately without paying per-chunk request overhead on very small
// slices.
const CHUNK_MS = 200;
const CHUNK_BYTES =
  (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * PCM_CHANNELS * CHUNK_MS) / 1000;

@Injectable()
export class AudioTranscriptionService {
  private readonly logger = new Logger(AudioTranscriptionService.name);
  private readonly client: TranscribeStreamingClient;
  private readonly enabled: boolean;
  private readonly defaultLanguage: string;

  constructor(
    private readonly prisma: PrismaService,
    @InjectMetric('chatbu_voice_message_transcribe_total')
    private readonly transcribeCounter: Counter<string>,
    @InjectMetric('chatbu_voice_message_transcribe_duration_seconds')
    private readonly transcribeDuration: Histogram<string>,
    @InjectMetric('chatbu_voice_message_audio_duration_seconds')
    private readonly audioDuration: Histogram<string>,
  ) {
    this.enabled = process.env.VOICE_TRANSCRIBE_ENABLED === 'true';
    this.defaultLanguage =
      process.env.VOICE_TRANSCRIBE_LANG_DEFAULT || 'tr-TR';
    this.client = new TranscribeStreamingClient({
      region: process.env.AWS_REGION || 'eu-central-1',
    });
    // fluent-ffmpeg needs an absolute binary path in stripped container
    // images; @ffmpeg-installer/ffmpeg ships a portable one.
    ffmpeg.setFfmpegPath(ffmpegPath.path);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async transcribe(input: AudioTranscribeInput): Promise<AudioTranscribeOutput> {
    if (!this.enabled) {
      throw new ServiceUnavailableException({
        error: 'voice_transcribe_disabled',
      });
    }
    if (!input.audio || input.audio.length === 0) {
      throw new BadRequestException({ error: 'empty_audio' });
    }
    if (input.audio.length > MAX_AUDIO_BYTES) {
      this.transcribeCounter
        .labels(input.channel, 'unsupported_format')
        .inc();
      throw new PayloadTooLargeException({ error: 'audio_too_large' });
    }

    const language = input.languageCode || this.defaultLanguage;
    const endTimer = this.transcribeDuration.startTimer({
      channel: input.channel,
    });

    let pcm: Buffer;
    try {
      pcm = await this.toPcm16kMono(input.audio, input.mimeType);
    } catch (err) {
      this.transcribeCounter
        .labels(input.channel, 'unsupported_format')
        .inc();
      endTimer();
      this.logger.warn(
        `[transcribe] ffmpeg decode failed bot=${input.tenantContext.botId} chat=${input.tenantContext.chatId} mime=${input.mimeType}: ${err?.message}`,
      );
      throw new BadRequestException({ error: 'unsupported_audio_format' });
    }

    const durationSeconds = this.pcmDurationSeconds(pcm);
    this.audioDuration.labels(input.channel).observe(durationSeconds);

    if (durationSeconds > MAX_DURATION_SECONDS) {
      this.transcribeCounter
        .labels(input.channel, 'unsupported_format')
        .inc();
      endTimer();
      throw new PayloadTooLargeException({ error: 'audio_too_long' });
    }

    let transcript = '';
    try {
      transcript = await this.streamPcmToTranscribe(pcm, language);
    } catch (err) {
      this.transcribeCounter.labels(input.channel, 'error').inc();
      endTimer();
      this.logger.error(
        `[transcribe] AWS Transcribe failed bot=${input.tenantContext.botId} chat=${input.tenantContext.chatId}: ${err?.message}`,
      );
      throw new ServiceUnavailableException({ error: 'transcribe_failed' });
    }

    endTimer();
    transcript = transcript.trim();
    const outcome = transcript.length === 0 ? 'empty' : 'success';
    this.transcribeCounter.labels(input.channel, outcome).inc();

    if (outcome === 'success') {
      await this.incrementQuota(
        input.tenantContext.teamId,
        durationSeconds,
      );
    }

    return {
      transcript,
      durationSeconds,
      languageDetected: language,
      provider: 'aws-transcribe',
    };
  }

  private pcmDurationSeconds(pcm: Buffer): number {
    return (
      pcm.length / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE * PCM_CHANNELS)
    );
  }

  private toPcm16kMono(audio: Buffer, mimeType: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const inputStream = Readable.from(audio);
      const chunks: Buffer[] = [];
      const inputFormat = this.mimeToFfmpegFormat(mimeType);

      const command = ffmpeg(inputStream);
      if (inputFormat) {
        command.inputFormat(inputFormat);
      }
      command
        .noVideo()
        .audioChannels(PCM_CHANNELS)
        .audioFrequency(PCM_SAMPLE_RATE)
        .audioCodec('pcm_s16le')
        .format('s16le')
        .on('error', (err) => reject(err))
        .on('end', () => resolve(Buffer.concat(chunks)))
        .pipe()
        .on('data', (c: Buffer) => chunks.push(c))
        .on('error', (err) => reject(err));
    });
  }

  private mimeToFfmpegFormat(mimeType: string): string | undefined {
    const base = (mimeType || '').split(';')[0].trim().toLowerCase();
    switch (base) {
      case 'audio/ogg':
      case 'audio/opus':
        return 'ogg';
      case 'audio/webm':
        return 'webm';
      case 'audio/mp4':
      case 'audio/m4a':
      case 'audio/x-m4a':
        return 'mp4';
      case 'audio/mpeg':
      case 'audio/mp3':
        return 'mp3';
      case 'audio/wav':
      case 'audio/x-wav':
      case 'audio/wave':
        return 'wav';
      default:
        return undefined; // let ffmpeg probe
    }
  }

  private async streamPcmToTranscribe(
    pcm: Buffer,
    language: string,
  ): Promise<string> {
    const audioStream = this.pcmChunks(pcm);
    const command = new StartStreamTranscriptionCommand({
      LanguageCode: language as any,
      MediaSampleRateHertz: PCM_SAMPLE_RATE,
      MediaEncoding: 'pcm',
      AudioStream: audioStream,
    });
    const response = await this.client.send(command);

    let full = '';
    if (!response.TranscriptResultStream) {
      return full;
    }
    for await (const event of response.TranscriptResultStream) {
      const results = event.TranscriptEvent?.Transcript?.Results || [];
      for (const r of results) {
        if (r.IsPartial) continue;
        const alt = r.Alternatives?.[0];
        if (alt?.Transcript) {
          full += (full.length ? ' ' : '') + alt.Transcript;
        }
      }
    }
    return full;
  }

  private async *pcmChunks(
    pcm: Buffer,
  ): AsyncGenerator<AudioStream, void, unknown> {
    for (let offset = 0; offset < pcm.length; offset += CHUNK_BYTES) {
      const slice = pcm.subarray(
        offset,
        Math.min(offset + CHUNK_BYTES, pcm.length),
      );
      yield { AudioEvent: { AudioChunk: slice } };
    }
  }

  private async incrementQuota(
    teamId: string,
    durationSeconds: number,
  ): Promise<void> {
    // Ceil to whole minutes so a 12-second voice note doesn't round to
    // zero — cost aggregation on the Grafana side reconstructs seconds
    // from the audio-duration histogram; this counter is the billing
    // safety net.
    const minutes = Math.max(1, Math.ceil(durationSeconds / 60));
    try {
      await this.prisma.quota.updateMany({
        where: { teamId },
        data: { voiceMessageMinutesUsed: { increment: minutes } },
      });
    } catch (err) {
      this.logger.warn(
        `[transcribe] quota increment skipped team=${teamId} minutes=${minutes}: ${err?.message}`,
      );
    }
  }
}
