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
  del: jest.Mock;
  quit: jest.Mock;
  on: jest.Mock;
} = {
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue('OK'),
  on: jest.fn(),
};

describe('OtpChannelPreferenceService', () => {
  const originalEnv = { ...process.env };

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
    await expect(service.peek('chat-1')).resolves.toBe('whatsapp');
  });

  it('defaults to sms when no choice was ever recorded', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockResolvedValue(null);
    await expect(service.peek('chat-unknown')).resolves.toBe('sms');
  });

  it('defaults to sms for a stored value it does not recognise', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockResolvedValue('carrier-pigeon');
    await expect(service.peek('chat-1')).resolves.toBe('sms');
  });

  it('defaults to sms when Redis read throws', async () => {
    const service = new OtpChannelPreferenceService();
    mockRedis.get.mockRejectedValue(new Error('connection reset'));
    await expect(service.peek('chat-1')).resolves.toBe('sms');
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
    await expect(service.peek('chat-1')).resolves.toBe('sms');
    expect(mockRedis.set).not.toHaveBeenCalled();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('reports sms for a missing chatId without hitting Redis', async () => {
    const service = new OtpChannelPreferenceService();

    await expect(service.peek(null)).resolves.toBe('sms');
    await expect(service.peek(undefined)).resolves.toBe('sms');
    await expect(service.peek('')).resolves.toBe('sms');
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  describe('consumeForOtp — single-use', () => {
    it('returns the visitor choice on the first code and marks it used', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp');

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('whatsapp');
      expect(mockRedis.set).toHaveBeenCalledWith(
        'lead:otp-channel:chat-1',
        'whatsapp_used',
        'EX',
        30 * 60,
      );
    });

    it('falls back to SMS on the resend and clears the spent choice', async () => {
      // A number with no WhatsApp account fails asynchronously at Twilio —
      // our send succeeds and the code never arrives. Without this, the
      // resend would go to WhatsApp too and the visitor would be stuck.
      // Clearing makes the callers' cooldown bypass one-shot.
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp_used');

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('sms');
      expect(mockRedis.del).toHaveBeenCalledWith('lead:otp-channel:chat-1');
    });

    it('still falls back to SMS when clearing the spent choice fails', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp_used');
      mockRedis.del.mockRejectedValue(new Error('READONLY'));

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('sms');
    });

    it('still delivers the chosen channel when marking it used fails', async () => {
      // Failing to record "used" must never withhold a code the visitor
      // is waiting for; worst case the resend also goes over WhatsApp.
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp');
      mockRedis.set.mockRejectedValue(new Error('READONLY'));

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('whatsapp');
    });

    it('never marks anything when the visitor never chose WhatsApp', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue(null);

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('sms');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it('defaults to sms when the read throws', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockRejectedValue(new Error('connection reset'));

      await expect(service.consumeForOtp('chat-1')).resolves.toBe('sms');
    });
  });

  describe('peek — non-consuming readers', () => {
    it('still reports whatsapp after the OTP consumed the mark', async () => {
      // AppointmentService stamps the channel onto the appointment AFTER
      // the booking OTP already consumed it; the confirmation and every
      // later reminder must still follow the visitor's choice.
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp_used');

      await expect(service.peek('chat-1')).resolves.toBe('whatsapp');
      expect(mockRedis.set).not.toHaveBeenCalled();
    });
  });

  describe('hasSpentWhatsAppChoice — cooldown bypass probe', () => {
    it('is true once a WhatsApp code has gone out, so the SMS rescue is not blocked', async () => {
      // chatbu-dev 2026-09-08: WhatsApp code at 14:42:25, visitor said it
      // never arrived at 14:42:40, and the 60s cooldown answered "wait a
      // few minutes". Nobody waits a minute before saying a code didn't
      // come — the fallback is immediate or it may as well not exist.
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp_used');

      await expect(service.hasSpentWhatsAppChoice('chat-1')).resolves.toBe(true);
      expect(mockRedis.set).not.toHaveBeenCalled();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it('is false before any code has gone out, so the normal cooldown still applies', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp');

      await expect(service.hasSpentWhatsAppChoice('chat-1')).resolves.toBe(false);
    });

    it('is false with no choice at all, and false when Redis throws', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue(null);
      await expect(service.hasSpentWhatsAppChoice('chat-1')).resolves.toBe(false);

      mockRedis.get.mockRejectedValue(new Error('connection reset'));
      await expect(service.hasSpentWhatsAppChoice('chat-1')).resolves.toBe(false);
    });

    it('the bypass is one-shot — the fallback clears the key', async () => {
      const service = new OtpChannelPreferenceService();
      mockRedis.get.mockResolvedValue('whatsapp_used');

      await service.consumeForOtp('chat-1');
      expect(mockRedis.del).toHaveBeenCalledWith('lead:otp-channel:chat-1');

      // Key gone → probe false → next request is back under the cooldown.
      mockRedis.get.mockResolvedValue(null);
      await expect(service.hasSpentWhatsAppChoice('chat-1')).resolves.toBe(false);
    });
  });
});
