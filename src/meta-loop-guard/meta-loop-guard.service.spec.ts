import { MetaLoopGuardService } from './meta-loop-guard.service';

describe('MetaLoopGuardService', () => {
  let service: MetaLoopGuardService;
  let redis: {
    get: jest.Mock;
    lrange: jest.Mock;
    multi: jest.Mock;
  };
  let counter: { labels: jest.Mock };

  const makeService = (env: Record<string, string | undefined> = {}) => {
    const prev: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(env)) {
      prev[k] = process.env[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    const inc = jest.fn();
    counter = { labels: jest.fn().mockReturnValue({ inc }) };
    const s = new MetaLoopGuardService(counter as any);
    for (const [k, v] of Object.entries(prev)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    return s;
  };

  beforeEach(() => {
    // No REDIS_URL in the constructor env — inject a fake client after
    // construction so the checks run their Redis branches.
    service = makeService({ REDIS_URL: undefined, META_LOOP_GUARD_ENABLED: undefined });
    const multiChain = {
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      lpush: jest.fn().mockReturnThis(),
      ltrim: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    redis = {
      get: jest.fn().mockResolvedValue(null),
      lrange: jest.fn().mockResolvedValue([]),
      multi: jest.fn().mockReturnValue(multiChain),
    };
    (service as any).redis = redis;
  });

  describe('shouldRateLimit', () => {
    it('false while under the window budget', async () => {
      redis.get.mockResolvedValue('19');
      expect(await service.shouldRateLimit('b1', 'c1', 'instagram')).toBe(false);
    });

    it('true at the budget, increments the metric', async () => {
      redis.get.mockResolvedValue('20');
      expect(await service.shouldRateLimit('b1', 'c1', 'instagram')).toBe(true);
      expect(counter.labels).toHaveBeenCalledWith('instagram', 'rate_limited');
    });

    it('false with no counter key (fresh conversation)', async () => {
      redis.get.mockResolvedValue(null);
      expect(await service.shouldRateLimit('b1', 'c1', 'whatsapp')).toBe(false);
    });

    it('fails open on Redis error', async () => {
      redis.get.mockRejectedValue(new Error('conn reset'));
      expect(await service.shouldRateLimit('b1', 'c1', 'messenger')).toBe(false);
    });
  });

  describe('isDuplicateReply', () => {
    it('true when the text matches a recent reply, increments the metric', async () => {
      redis.lrange.mockResolvedValue(['Görüşmek üzere! 👋😊', 'İyi günler! 😊👋']);
      expect(
        await service.isDuplicateReply('b1', 'c1', 'Görüşmek üzere! 👋😊', 'instagram'),
      ).toBe(true);
      expect(counter.labels).toHaveBeenCalledWith('instagram', 'duplicate_suppressed');
    });

    it('false for a novel reply', async () => {
      redis.lrange.mockResolvedValue(['Görüşmek üzere! 👋😊']);
      expect(
        await service.isDuplicateReply('b1', 'c1', 'Fiyat listemiz şöyle...', 'instagram'),
      ).toBe(false);
    });

    it('false on empty text', async () => {
      expect(await service.isDuplicateReply('b1', 'c1', '', 'whatsapp')).toBe(false);
      expect(redis.lrange).not.toHaveBeenCalled();
    });
  });

  describe('recordReply', () => {
    it('bumps rate counter + pushes onto the last-replies list', async () => {
      await service.recordReply('b1', 'c1', 'merhaba');
      const chain = redis.multi.mock.results[0].value;
      expect(chain.incr).toHaveBeenCalledWith('meta:loopguard:rate:b1:c1');
      expect(chain.lpush).toHaveBeenCalledWith('meta:loopguard:last:b1:c1', 'merhaba');
      expect(chain.ltrim).toHaveBeenCalledWith('meta:loopguard:last:b1:c1', 0, 1);
      expect(chain.exec).toHaveBeenCalled();
    });
  });

  describe('kill switch + no-redis', () => {
    it('META_LOOP_GUARD_ENABLED=false: no redis client, checks inert', async () => {
      const disabled = makeService({ META_LOOP_GUARD_ENABLED: 'false', REDIS_URL: 'redis://x' });
      expect((disabled as any).redis).toBeNull();
      expect(await disabled.shouldRateLimit('b', 'c', 'instagram')).toBe(false);
      expect(await disabled.isDuplicateReply('b', 'c', 'x', 'instagram')).toBe(false);
    });

    it('no REDIS_URL: checks inert', async () => {
      const inert = makeService({ REDIS_URL: undefined });
      expect(await inert.shouldRateLimit('b', 'c', 'whatsapp')).toBe(false);
    });
  });
});
