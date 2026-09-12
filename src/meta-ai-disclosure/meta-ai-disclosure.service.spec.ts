import { MetaAiDisclosureService } from './meta-ai-disclosure.service';

/**
 * The service builds its own ioredis client from REDIS_URL at construction
 * time, so these tests construct instances directly (no Nest testing module)
 * and swap the private `redis` handle for a stub — same approach as the
 * loop-guard spec family.
 */

const REPLY = 'Merhaba! Size nasıl yardımcı olabilirim?';

function makeService(opts: {
  redisSet?: jest.Mock;
  primaryLanguage?: string | null;
  botLookupFails?: boolean;
}) {
  // No REDIS_URL at construction → the service builds no real client;
  // the stub is injected afterwards.
  const prisma: any = {
    customerBots: {
      findUnique: opts.botLookupFails
        ? jest.fn().mockRejectedValue(new Error('db down'))
        : jest.fn().mockResolvedValue(
            opts.primaryLanguage === undefined ? null : { primaryLanguage: opts.primaryLanguage },
          ),
    },
  };
  const service = new MetaAiDisclosureService(prisma);
  (service as any).redis = opts.redisSet ? { set: opts.redisSet, disconnect: jest.fn() } : null;
  return { service, prisma };
}

afterEach(() => {
  delete process.env.META_AI_DISCLOSURE_ENABLED;
  delete process.env.FRONTEND_PRIVACY_POLICY_URL;
});

describe('MetaAiDisclosureService', () => {
  it('prepends the disclosure exactly on the first reply of a chat (SETNX ok)', async () => {
    const redisSet = jest.fn().mockResolvedValue('OK');
    const { service } = makeService({ redisSet, primaryLanguage: 'en' });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toContain("You're chatting with an AI assistant");
    expect(out.endsWith(REPLY)).toBe(true);
    expect(redisSet).toHaveBeenCalledWith(
      'meta:ai-disclosure:chat-1',
      '1',
      'EX',
      expect.any(Number),
      'NX',
    );
  });

  it('leaves later replies untouched (SETNX misses)', async () => {
    const redisSet = jest.fn().mockResolvedValue(null);
    const { service, prisma } = makeService({ redisSet, primaryLanguage: 'en' });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toBe(REPLY);
    // No language lookup on the non-first path — zero extra DB traffic.
    expect(prisma.customerBots.findUnique).not.toHaveBeenCalled();
  });

  it("localizes by the bot's primaryLanguage", async () => {
    const { service } = makeService({
      redisSet: jest.fn().mockResolvedValue('OK'),
      primaryLanguage: 'tr',
    });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toContain('yapay zekâ asistanıyla');
  });

  it('falls back to English for unknown or missing languages and failed lookups', async () => {
    for (const setup of [
      makeService({ redisSet: jest.fn().mockResolvedValue('OK'), primaryLanguage: 'xx' }),
      makeService({ redisSet: jest.fn().mockResolvedValue('OK'), primaryLanguage: undefined }),
      makeService({ redisSet: jest.fn().mockResolvedValue('OK'), botLookupFails: true }),
    ]) {
      const out = await setup.service.withDisclosure('bot-1', 'chat-1', REPLY);
      expect(out).toContain("You're chatting with an AI assistant");
    }
  });

  it('includes the privacy link from FRONTEND_PRIVACY_POLICY_URL', async () => {
    process.env.FRONTEND_PRIVACY_POLICY_URL = 'https://chatbu.io/pp-test';
    const { service } = makeService({
      redisSet: jest.fn().mockResolvedValue('OK'),
      primaryLanguage: 'en',
    });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toContain('https://chatbu.io/pp-test');
  });

  it("defaults the privacy link to the app's CMS-served page in the disclosure language", async () => {
    delete process.env.FRONTEND_PRIVACY_POLICY_URL;
    const { service } = makeService({
      redisSet: jest.fn().mockResolvedValue('OK'),
      primaryLanguage: 'en',
    });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    // Same builder as the widget consent card — app origin, CMS route,
    // locale hint. Never the marketing site.
    expect(out).toContain('/privacy-policy?lng=en');
    expect(out).not.toContain('https://chatbu.io/');
  });

  it('passes replies through untouched without Redis (graceful degrade)', async () => {
    const { service } = makeService({ primaryLanguage: 'en' }); // redis = null
    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);
    expect(out).toBe(REPLY);
  });

  it('passes replies through untouched when the kill switch is off', async () => {
    process.env.META_AI_DISCLOSURE_ENABLED = 'false';
    const redisSet = jest.fn().mockResolvedValue('OK');
    const { service } = makeService({ redisSet, primaryLanguage: 'en' });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toBe(REPLY);
    expect(redisSet).not.toHaveBeenCalled();
  });

  it('passes replies through when Redis errors mid-call (never throws)', async () => {
    const redisSet = jest.fn().mockRejectedValue(new Error('conn reset'));
    const { service } = makeService({ redisSet, primaryLanguage: 'en' });

    const out = await service.withDisclosure('bot-1', 'chat-1', REPLY);

    expect(out).toBe(REPLY);
  });

  it('skips chats without a chatId', async () => {
    const redisSet = jest.fn().mockResolvedValue('OK');
    const { service } = makeService({ redisSet, primaryLanguage: 'en' });

    const out = await service.withDisclosure('bot-1', null, REPLY);

    expect(out).toBe(REPLY);
    expect(redisSet).not.toHaveBeenCalled();
  });
});
