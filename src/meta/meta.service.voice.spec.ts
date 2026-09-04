import { MetaService } from './meta.service';

// Voice-note paths through the Messenger webhook handler (Slice B).
// The Instagram handler shares extractTextOrTranscribe verbatim, so the
// Messenger matrix covers both; IG-only divergence (contact name fetch)
// is out of scope here.
describe('MetaService voice-note handling', () => {
  let service: MetaService;
  let botService: { chat: jest.Mock };
  let metaEmbedded: { findByPageId: jest.Mock };
  let metaChatCursor: { resolveChatId: jest.Mock };
  let audioTranscription: { isEnabled: jest.Mock; transcribe: jest.Mock };
  let metaAudio: { downloadMessengerAudio: jest.Mock };

  const integration = { teamId: 'team1', config: { botId: 'bot1', pageAccessToken: 'tok' } };

  const webhookBody = (message: any) => ({
    object: 'page',
    entry: [
      {
        id: 'page1',
        messaging: [{ sender: { id: 'psid1' }, message }],
      },
    ],
  });

  beforeEach(() => {
    botService = { chat: jest.fn().mockResolvedValue({ response: 'ok' }) };
    metaEmbedded = { findByPageId: jest.fn().mockResolvedValue(integration) };
    metaChatCursor = { resolveChatId: jest.fn().mockResolvedValue('chat1') };
    audioTranscription = {
      isEnabled: jest.fn().mockReturnValue(true),
      transcribe: jest.fn().mockResolvedValue({
        transcript: 'randevu almak istiyorum',
        durationSeconds: 4.2,
        languageDetected: 'tr-TR',
        provider: 'aws-transcribe',
      }),
    };
    metaAudio = {
      downloadMessengerAudio: jest.fn().mockResolvedValue({
        audio: Buffer.from('opus'),
        mimeType: 'audio/mp4',
      }),
    };

    service = new MetaService(
      {} as any, // prisma — untouched in these paths
      botService as any,
      { get: jest.fn() } as any, // configService
      metaEmbedded as any,
      metaChatCursor as any,
      audioTranscription as any,
      metaAudio as any,
      { isOurs: jest.fn().mockResolvedValue(false), record: jest.fn() } as any, // sentRegistry
      { shouldRateLimit: jest.fn().mockResolvedValue(false), isDuplicateReply: jest.fn().mockResolvedValue(false), recordReply: jest.fn() } as any, // loopGuard
    );
    // sendMetaMessage does a real axios POST — stub it out.
    jest.spyOn(service as any, 'sendMetaMessage').mockResolvedValue(undefined);
  });

  it('text message flows to chat without touching the audio path', async () => {
    await service.handleWebhook(webhookBody({ text: 'merhaba' }));
    expect(botService.chat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'merhaba', sourceChannel: 'messenger' }),
      expect.anything(),
    );
    expect(metaAudio.downloadMessengerAudio).not.toHaveBeenCalled();
    expect(audioTranscription.transcribe).not.toHaveBeenCalled();
  });

  it('audio attachment is transcribed and the transcript goes to chat', async () => {
    await service.handleWebhook(
      webhookBody({
        attachments: [{ type: 'audio', payload: { url: 'https://cdn.fbsbx.com/v.mp4' } }],
      }),
    );
    expect(metaAudio.downloadMessengerAudio).toHaveBeenCalledWith('https://cdn.fbsbx.com/v.mp4');
    expect(audioTranscription.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ channel: 'messenger', mimeType: 'audio/mp4' }),
    );
    expect(botService.chat).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'randevu almak istiyorum' }),
      expect.anything(),
    );
  });

  it('kill switch closed: audio is dropped without any download attempt', async () => {
    audioTranscription.isEnabled.mockReturnValue(false);
    await service.handleWebhook(
      webhookBody({
        attachments: [{ type: 'audio', payload: { url: 'https://cdn.fbsbx.com/v.mp4' } }],
      }),
    );
    expect(metaAudio.downloadMessengerAudio).not.toHaveBeenCalled();
    expect(botService.chat).not.toHaveBeenCalled();
  });

  it('empty transcript: silent drop, chat never called', async () => {
    audioTranscription.transcribe.mockResolvedValue({
      transcript: '',
      durationSeconds: 2,
      languageDetected: 'tr-TR',
      provider: 'aws-transcribe',
    });
    await service.handleWebhook(
      webhookBody({
        attachments: [{ type: 'audio', payload: { url: 'https://cdn.fbsbx.com/v.mp4' } }],
      }),
    );
    expect(botService.chat).not.toHaveBeenCalled();
  });

  it('transcription failure: webhook batch survives, chat never called', async () => {
    audioTranscription.transcribe.mockRejectedValue(new Error('503 transcribe_failed'));
    await expect(
      service.handleWebhook(
        webhookBody({
          attachments: [{ type: 'audio', payload: { url: 'https://cdn.fbsbx.com/v.mp4' } }],
        }),
      ),
    ).resolves.toBeUndefined();
    expect(botService.chat).not.toHaveBeenCalled();
  });

  it('non-audio attachment (image/sticker): silent drop as before', async () => {
    await service.handleWebhook(
      webhookBody({
        attachments: [{ type: 'image', payload: { url: 'https://cdn.fbsbx.com/p.jpg' } }],
      }),
    );
    expect(metaAudio.downloadMessengerAudio).not.toHaveBeenCalled();
    expect(botService.chat).not.toHaveBeenCalled();
  });

  it('chat cursor is only resolved for usable content (no cursor churn on drops)', async () => {
    await service.handleWebhook(
      webhookBody({
        attachments: [{ type: 'image', payload: { url: 'https://cdn.fbsbx.com/p.jpg' } }],
      }),
    );
    expect(metaChatCursor.resolveChatId).not.toHaveBeenCalled();
  });
});
