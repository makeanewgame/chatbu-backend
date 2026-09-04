import { MetaService } from './meta.service';

// Owner-echo takeover paths (Messenger loop; the Instagram loop calls the
// same handleOwnerEcho verbatim). An echo event carries sender=PAGE,
// recipient=VISITOR — the inverse of a normal inbound message.
describe('MetaService owner-echo takeover', () => {
  let service: MetaService;
  let prisma: {
    customerChats: { findFirst: jest.Mock; update: jest.Mock };
    customerChatDetails: { findFirst: jest.Mock; create: jest.Mock };
  };
  let botService: { chat: jest.Mock };
  let metaEmbedded: { findByPageId: jest.Mock };
  let sentRegistry: { isOurs: jest.Mock; record: jest.Mock };

  const integration = { teamId: 'team1', config: { botId: 'bot1', pageAccessToken: 'tok' } };
  const activeChat = { id: 'row1', chatId: 'fb_v1', chatStatus: 'BOT_ACTIVE' };

  const echoBody = (message: any) => ({
    object: 'page',
    entry: [
      {
        id: 'page1',
        messaging: [
          {
            sender: { id: 'page1' },
            recipient: { id: 'visitor1' },
            message: { is_echo: true, ...message },
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    process.env.META_ECHO_TAKEOVER_ENABLED = 'true';
    prisma = {
      customerChats: {
        findFirst: jest.fn().mockResolvedValue(activeChat),
        update: jest.fn().mockResolvedValue({}),
      },
      customerChatDetails: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    botService = { chat: jest.fn() };
    metaEmbedded = { findByPageId: jest.fn().mockResolvedValue(integration) };
    sentRegistry = {
      isOurs: jest.fn().mockResolvedValue(false),
      record: jest.fn().mockResolvedValue(undefined),
    };

    service = new MetaService(
      prisma as any,
      botService as any,
      { get: jest.fn() } as any,
      metaEmbedded as any,
      { resolveChatId: jest.fn().mockResolvedValue('fb_v1') } as any,
      { isEnabled: jest.fn().mockReturnValue(false), transcribe: jest.fn() } as any,
      { downloadMessengerAudio: jest.fn() } as any,
      sentRegistry as any,
      { shouldRateLimit: jest.fn().mockResolvedValue(false), isDuplicateReply: jest.fn().mockResolvedValue(false), recordReply: jest.fn() } as any, // loopGuard
    );
    // sendMetaMessage does a real axios POST — stub it out.
    jest.spyOn(service as any, 'sendMetaMessage').mockResolvedValue(undefined);
  });

  afterEach(() => {
    delete process.env.META_ECHO_TAKEOVER_ENABLED;
  });

  it('owner-typed echo flips the chat to HUMAN_ACTIVE and mirrors the text', async () => {
    await service.handleWebhook(echoBody({ mid: 'm123', text: 'Merhaba, ben devralıyorum' }));

    expect(sentRegistry.isOurs).toHaveBeenCalledWith('m123');
    expect(prisma.customerChatDetails.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        chatId: 'row1',
        sender: 'agent',
        message: 'Merhaba, ben devralıyorum',
      }),
    });
    expect(prisma.customerChats.update).toHaveBeenCalledWith({
      where: { id: 'row1' },
      data: expect.objectContaining({ chatStatus: 'HUMAN_ACTIVE' }),
    });
    expect(botService.chat).not.toHaveBeenCalled();
  });

  it('our own send (mid in registry) is skipped entirely', async () => {
    sentRegistry.isOurs.mockResolvedValue(true);
    await service.handleWebhook(echoBody({ mid: 'm123', text: 'bot cevabı' }));

    expect(prisma.customerChats.update).not.toHaveBeenCalled();
    expect(prisma.customerChatDetails.create).not.toHaveBeenCalled();
  });

  it('kill switch off: echo ignored exactly like before', async () => {
    process.env.META_ECHO_TAKEOVER_ENABLED = 'false';
    await service.handleWebhook(echoBody({ mid: 'm123', text: 'owner mesajı' }));

    expect(sentRegistry.isOurs).not.toHaveBeenCalled();
    expect(prisma.customerChats.update).not.toHaveBeenCalled();
  });

  it('transcript dedupe guards Redis misses (identical agent line <120s ago)', async () => {
    prisma.customerChatDetails.findFirst.mockResolvedValue({
      createdAt: new Date(Date.now() - 30_000),
    });
    await service.handleWebhook(echoBody({ mid: 'm999', text: 'tekrar gelen echo' }));

    expect(prisma.customerChatDetails.create).not.toHaveBeenCalled();
    expect(prisma.customerChats.update).not.toHaveBeenCalled();
  });

  it('no active chat for the visitor: nothing to hand over', async () => {
    prisma.customerChats.findFirst.mockResolvedValue(null);
    await service.handleWebhook(echoBody({ mid: 'm1', text: 'selam' }));

    expect(prisma.customerChats.update).not.toHaveBeenCalled();
  });

  it('attachment-only owner echo mirrors a placeholder', async () => {
    await service.handleWebhook(
      echoBody({ mid: 'm7', attachments: [{ type: 'image', payload: { url: 'x' } }] }),
    );

    expect(prisma.customerChatDetails.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ message: '[attachment]' }),
    });
    expect(prisma.customerChats.update).toHaveBeenCalledWith({
      where: { id: 'row1' },
      data: expect.objectContaining({ chatStatus: 'HUMAN_ACTIVE' }),
    });
  });

  it('normal inbound (non-echo) messages still reach the bot', async () => {
    botService.chat.mockResolvedValue({ content: 'cevap' });
    await service.handleWebhook({
      object: 'page',
      entry: [
        {
          id: 'page1',
          messaging: [
            { sender: { id: 'visitor1' }, message: { text: 'merhaba' } },
          ],
        },
      ],
    });
    expect(botService.chat).toHaveBeenCalled();
    expect(prisma.customerChats.update).not.toHaveBeenCalled();
  });
});
