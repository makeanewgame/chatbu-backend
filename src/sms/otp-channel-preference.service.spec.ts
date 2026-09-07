import { OtpChannelPreferenceService } from './otp-channel-preference.service';

/**
 * The service's whole job is to be unable to break the SMS path: every
 * abnormal input, missing Redis, or Redis error must resolve to 'sms'.
 * These tests hold that line — a regression here would silently route
 * codes to a channel the visitor never picked, or (worse) to WhatsApp
 * for someone who cannot receive it.
 *
 * `ioredis` is mocked at the module boundary rather than run against a
 * real server: the only Redis behaviour that matters here is "returns
 * what was stored, or throws", and a fake gives us the throwing case
 * that a live server won't produce on demand.
 */
jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => mockRedis),
  };
});

const mockRedis: {
  set: jest.Mock;
  get: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
} = {
  set: jest.fn(),
  get: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

describe('OtpChannelPreferenceService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    mockRedis.get.mockResolvedValue(null);
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('round-trips an explicit whatsapp choice', async () => {
    const service = new OtpChannelPreferenceService();
    await service.set('chat-1', 'whatsapp');

    expect(mockRedis.set).toHaveBeenCalledWith(
      'lead:otp-channel:chat-1',
      'whatsapp',
      'EX',
      30 * 60,
    );

    mockRedis.get.mockResolvedValue('whatsapp');
    await expect(service.get('chat-1')).resolves.toBe('whatsapp');
  });

  it('defaults to sms when no choice was ever recorded', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockResolvedValue(null);
    await expect(service.get('chat-unknown')).resolves.toBe('sms');
  });

  it('defaults to sms for a stored value it does not recognise', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockResolvedValue('carrier-pigeon');
    await expect(service.get('chat-1')).resolves.toBe('sms');
  });

  it('defaults to sms when Redis read throws', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockRejectedValue(new Error('connection reset'));
    await expect(service.get('chat-1')).resolves.toBe('sms');
  });

  it('swallows a Redis write failure — a preference is never worth failing the form submit', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.set.mockRejectedValue(new Error('READONLY'));
    await expect(service.set('chat-1', 'whatsapp')).resolves.toBeUndefined();
  });

  it('reports sms and touches no client when REDIS_URL is unset', async () => {
    delete process.env.REDIS_URL;
    const service = new OtpChannelPreferenceService();

    await service.set('chat-1', 'whatsapp');
    await expect(service.get('chat-1')).resolves.toBe('sms');
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('reports sms for a missing chatId without hitting Redis', async () => {
    const service = new OtpChannelPreferenceService();

    await expect(service.get(null)).resolves.toBe('sms');
    await expect(service.get(undefined)).resolves.toBe('sms');
    await expect(service.get('')).resolves.toBe('sms');
    expect(mockRedis.get).not.toHaveBeenCalled();
  });
});
