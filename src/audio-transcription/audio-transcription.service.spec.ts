import { Test, TestingModule } from '@nestjs/testing';
import { getToken } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import {
  BadRequestException,
  PayloadTooLargeException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AudioTranscriptionService } from './audio-transcription.service';
import { PrismaService } from '../prisma/prisma.service';

// AWS SDK — module-level mock so the service's `new TranscribeStreamingClient()`
// call in the constructor grabs the mock instead of touching the network.
const mockSend = jest.fn();
jest.mock('@aws-sdk/client-transcribe-streaming', () => {
  return {
    TranscribeStreamingClient: jest.fn().mockImplementation(() => ({
      send: mockSend,
    })),
    StartStreamTranscriptionCommand: jest
      .fn()
      .mockImplementation((input) => ({ input })),
  };
});

// fluent-ffmpeg — the ffmpeg binary isn't installed in CI, and even if
// it were the decode is not what we're testing. Return a fixed PCM
// buffer sized to a predictable duration.
jest.mock('@ffmpeg-installer/ffmpeg', () => ({ path: '/usr/bin/ffmpeg' }));

const mockFfmpegChain = () => {
  const chain: any = {};
  chain.inputFormat = jest.fn().mockReturnValue(chain);
  chain.noVideo = jest.fn().mockReturnValue(chain);
  chain.audioChannels = jest.fn().mockReturnValue(chain);
  chain.audioFrequency = jest.fn().mockReturnValue(chain);
  chain.audioCodec = jest.fn().mockReturnValue(chain);
  chain.format = jest.fn().mockReturnValue(chain);
  const endHandlers: Array<() => void> = [];
  const dataHandlers: Array<(c: Buffer) => void> = [];
  chain.on = jest.fn().mockImplementation(function (event: string, cb: any) {
    if (event === 'end') endHandlers.push(cb);
    return chain;
  });
  const pipeStream: any = {};
  pipeStream.on = jest.fn().mockImplementation(function (event: string, cb: any) {
    if (event === 'data') dataHandlers.push(cb);
    return pipeStream;
  });
  chain.pipe = jest.fn().mockImplementation(() => {
    // Simulate ffmpeg lifecycle: data first, then end. Register order is
    // service-side (.on('end', ...).pipe().on('data', ...)), so we defer
    // to setImmediate so both handlers have been added.
    setImmediate(() => {
      // 3.2s of 16kHz mono 16-bit PCM = 102 400 bytes
      dataHandlers.forEach((cb) => cb(Buffer.alloc(3.2 * 16000 * 2)));
      endHandlers.forEach((cb) => cb());
    });
    return pipeStream;
  });
  return chain;
};

jest.mock('fluent-ffmpeg', () => {
  const factory: any = jest.fn(() => mockFfmpegChain());
  factory.setFfmpegPath = jest.fn();
  return factory;
});

describe('AudioTranscriptionService', () => {
  let service: AudioTranscriptionService;
  let prisma: { quota: { updateMany: jest.Mock } };

  const makeCounter = (): Partial<Counter<string>> => {
    const inc = jest.fn();
    return {
      labels: jest.fn().mockReturnValue({ inc }),
      inc,
    } as unknown as Counter<string>;
  };
  const makeHistogram = (): Partial<Histogram<string>> => ({
    labels: jest.fn().mockReturnValue({ observe: jest.fn() }),
    observe: jest.fn(),
    startTimer: jest.fn().mockReturnValue(jest.fn()),
  }) as unknown as Histogram<string>;

  beforeEach(async () => {
    process.env.VOICE_TRANSCRIBE_ENABLED = 'true';
    process.env.VOICE_TRANSCRIBE_LANG_DEFAULT = 'tr-TR';
    mockSend.mockReset();
    prisma = { quota: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AudioTranscriptionService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: getToken('chatbu_voice_message_transcribe_total'),
          useValue: makeCounter(),
        },
        {
          provide: getToken('chatbu_voice_message_transcribe_duration_seconds'),
          useValue: makeHistogram(),
        },
        {
          provide: getToken('chatbu_voice_message_audio_duration_seconds'),
          useValue: makeHistogram(),
        },
      ],
    }).compile();

    service = module.get(AudioTranscriptionService);
  });

  afterEach(() => {
    delete process.env.VOICE_TRANSCRIBE_ENABLED;
    delete process.env.VOICE_TRANSCRIBE_LANG_DEFAULT;
  });

  const tenantContext = { botId: 'bot1', teamId: 'team1', chatId: 'chat1' };

  const fakeTranscribeResponse = (transcript: string) => ({
    TranscriptResultStream: (async function* () {
      yield {
        TranscriptEvent: {
          Transcript: {
            Results: [
              {
                IsPartial: false,
                Alternatives: [{ Transcript: transcript }],
              },
            ],
          },
        },
      };
    })(),
  });

  it('is disabled when VOICE_TRANSCRIBE_ENABLED != "true"', async () => {
    process.env.VOICE_TRANSCRIBE_ENABLED = 'false';
    // Re-instantiate to pick up the new env
    const disabled = new AudioTranscriptionService(
      prisma as any,
      makeCounter() as any,
      makeHistogram() as any,
      makeHistogram() as any,
    );
    await expect(
      disabled.transcribe({
        audio: Buffer.from('x'),
        mimeType: 'audio/ogg',
        channel: 'widget',
        tenantContext,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects empty audio', async () => {
    await expect(
      service.transcribe({
        audio: Buffer.alloc(0),
        mimeType: 'audio/ogg',
        channel: 'widget',
        tenantContext,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects blobs above the size cap', async () => {
    await expect(
      service.transcribe({
        audio: Buffer.alloc(6 * 1024 * 1024),
        mimeType: 'audio/ogg',
        channel: 'widget',
        tenantContext,
      }),
    ).rejects.toBeInstanceOf(PayloadTooLargeException);
  });

  it('returns transcript + duration + language on success', async () => {
    mockSend.mockResolvedValueOnce(
      fakeTranscribeResponse('Merhaba, randevu almak istiyorum.'),
    );
    const out = await service.transcribe({
      audio: Buffer.from('opus-bytes'),
      mimeType: 'audio/ogg; codecs=opus',
      channel: 'widget',
      tenantContext,
    });
    expect(out.transcript).toBe('Merhaba, randevu almak istiyorum.');
    expect(out.provider).toBe('aws-transcribe');
    expect(out.languageDetected).toBe('tr-TR');
    expect(out.durationSeconds).toBeCloseTo(3.2, 1);
    expect(prisma.quota.updateMany).toHaveBeenCalledWith({
      where: { teamId: 'team1' },
      data: { voiceMessageMinutesUsed: { increment: 1 } },
    });
  });

  it('honours the override language code', async () => {
    mockSend.mockResolvedValueOnce(fakeTranscribeResponse('hello there'));
    const out = await service.transcribe({
      audio: Buffer.from('opus'),
      mimeType: 'audio/ogg',
      languageCode: 'en-US',
      channel: 'messenger',
      tenantContext,
    });
    expect(out.languageDetected).toBe('en-US');
  });

  it('reports empty transcript as outcome="empty" and skips quota', async () => {
    mockSend.mockResolvedValueOnce(fakeTranscribeResponse(''));
    const out = await service.transcribe({
      audio: Buffer.from('silence'),
      mimeType: 'audio/ogg',
      channel: 'whatsapp',
      tenantContext,
    });
    expect(out.transcript).toBe('');
    expect(prisma.quota.updateMany).not.toHaveBeenCalled();
  });

  it('maps AWS Transcribe failures to 503', async () => {
    mockSend.mockRejectedValueOnce(new Error('throttled'));
    await expect(
      service.transcribe({
        audio: Buffer.from('opus'),
        mimeType: 'audio/ogg',
        channel: 'widget',
        tenantContext,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
