import { OtpDeliveryFallbackService, OtpFallbackContext } from './otp-delivery-fallback.service';

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => mockRedis),
}));

const mockRedis: { set: jest.Mock; get: jest.Mock; del: jest.Mock; quit: jest.Mock; on: jest.Mock } = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

describe('OtpDeliveryFallbackService', () => {
  const originalEnv = { ...process.env };
  const ctx: OtpFallbackContext = {
    flow: 'booking', botId: 'bot-1', chatId: 'chat-1', phone: '+905386450582', lang: 'tr',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    mockRedis.del.mockResolvedValue(1);
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips the context for a message id', async () => {
    const service = new OtpDeliveryFallbackService();
    await service.register('MM1', ctx);

    expect(mockRedis.set).toHaveBeenCalledWith(
      'otp:wa-sid:MM1', JSON.stringify(ctx), 'EX', 30 * 60,
    );

    mockRedis.get.mockResolvedValue(JSON.stringify(ctx));
    await expect(service.take('MM1')).resolves.toEqual(ctx);
  });

  it('claims a context exactly once — Twilio retries status callbacks', async () => {
    // A duplicate callback must not produce a second SMS.
    const service = new OtpDeliveryFallbackService();
    mockRedis.get.mockResolvedValue(JSON.stringify(ctx));

    await service.take('MM1');
    expect(mockRedis.del).toHaveBeenCalledWith('otp:wa-sid:MM1');
  });

  it('returns null for an unknown or already-claimed id', async () => {
    const service = new OtpDeliveryFallbackService();
    mockRedis.get.mockResolvedValue(null);
    await expect(service.take('MM-unknown')).resolves.toBeNull();
  });

  it('returns null rather than throwing on unparseable stored data', async () => {
    const service = new OtpDeliveryFallbackService();
    mockRedis.get.mockResolvedValue('not json');
    await expect(service.take('MM1')).resolves.toBeNull();
  });

  it('swallows a registration failure — the fallback is never worth failing a send', async () => {
    const service = new OtpDeliveryFallbackService();
    mockRedis.set.mockRejectedValue(new Error('READONLY'));
    await expect(service.register('MM1', ctx)).resolves.toBeUndefined();
  });

  it('no-ops entirely without Redis', async () => {
    delete process.env.REDIS_URL;
    const service = new OtpDeliveryFallbackService();

    await service.register('MM1', ctx);
    await expect(service.take('MM1')).resolves.toBeNull();
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });
});
