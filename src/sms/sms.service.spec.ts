import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { SmsService } from './sms.service';

/**
 * Faz A tests: verify that `sendSms` is the single transport funnel and
 * that the wrapper methods (`sendOtpSms`, `sendBookingConfirmationSms`,
 * `sendBookingReminderSms`) produce the expected localized bodies +
 * route through `sendSms` (not a private HTTP call each).
 *
 * NETGSM_MOCK is the primary lever: when true, no HTTP call is made and
 * the composed message body ends up in a logger.info line, which is what
 * we assert against. This keeps the tests deterministic and offline.
 */
describe('SmsService', () => {
  let service: SmsService;
  let http: { post: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    http = { post: jest.fn() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: HttpService, useValue: http },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    service = module.get(SmsService);
    process.env.NETGSM_MOCK = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------
  // sendSms — generic transport funnel
  // ---------------------------------------------------------------------

  describe('sendSms (generic)', () => {
    it('normalizes a Turkish 0-prefixed phone to 90XXXXXXXXXX before sending', async () => {
      await service.sendSms('0532 111 22 33', 'hello');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('905321112233'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"hello"'),
      );
    });

    it('tags the log line with the provided context', async () => {
      await service.sendSms('05321112233', 'x', 'my_flow');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would send my_flow'),
      );
    });

    it('defaults context to "generic" when omitted', async () => {
      await service.sendSms('05321112233', 'x');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would send generic'),
      );
    });

    it('does NOT hit the HTTP client in mock mode', async () => {
      await service.sendSms('05321112233', 'x');
      expect(http.post).not.toHaveBeenCalled();
    });

    it('throws when credentials are missing and mock is off', async () => {
      process.env.NETGSM_MOCK = 'false';
      delete process.env.NETGSM_USERNAME;
      delete process.env.NETGSM_PASSWORD;
      delete process.env.NETGSM_MSGHEADER;

      await expect(service.sendSms('05321112233', 'x')).rejects.toThrow(
        /SMS provider is not configured/,
      );
    });

    it('throws when NETGSM returns a non-success code', async () => {
      process.env.NETGSM_MOCK = 'false';
      process.env.NETGSM_USERNAME = 'u';
      process.env.NETGSM_PASSWORD = 'p';
      process.env.NETGSM_MSGHEADER = 'h';
      http.post.mockReturnValue(
        of({ data: { code: '80', jobid: 'j1' } } as AxiosResponse),
      );

      await expect(service.sendSms('05321112233', 'x')).rejects.toThrow(
        /NETGSM rejected/,
      );
    });

    it('accepts NETGSM success code "00"', async () => {
      process.env.NETGSM_MOCK = 'false';
      process.env.NETGSM_USERNAME = 'u';
      process.env.NETGSM_PASSWORD = 'p';
      process.env.NETGSM_MSGHEADER = 'h';
      http.post.mockReturnValue(
        of({ data: { code: '00', jobid: 'j1' } } as AxiosResponse),
      );

      await expect(service.sendSms('05321112233', 'x')).resolves.toBeUndefined();
      expect(http.post).toHaveBeenCalledTimes(1);
    });

    it('propagates HTTP transport errors', async () => {
      process.env.NETGSM_MOCK = 'false';
      process.env.NETGSM_USERNAME = 'u';
      process.env.NETGSM_PASSWORD = 'p';
      process.env.NETGSM_MSGHEADER = 'h';
      http.post.mockReturnValue(throwError(() => new Error('timeout')));

      await expect(service.sendSms('05321112233', 'x')).rejects.toThrow(
        'timeout',
      );
    });
  });

  // ---------------------------------------------------------------------
  // sendOtpSms — OTP wrapper
  // ---------------------------------------------------------------------

  describe('sendOtpSms', () => {
    it('composes the Turkish body by default', async () => {
      await service.sendOtpSms('05321112233', '123456', 'Test Bot');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Test Bot doğrulama kodunuz: 123456'),
      );
    });

    it('composes the English body when lang=en', async () => {
      await service.sendOtpSms('05321112233', '123456', 'Test Bot', 'en');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Your Test Bot verification code: 123456'),
      );
    });

    it('routes through sendSms (tagged as "otp")', async () => {
      await service.sendOtpSms('05321112233', '000000', 'B');
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would send otp'),
      );
    });
  });

  // ---------------------------------------------------------------------
  // sendBookingConfirmationSms
  // ---------------------------------------------------------------------

  describe('sendBookingConfirmationSms', () => {
    // A UTC instant equivalent to 2026-10-06 14:30 Europe/Istanbul (UTC+3).
    const start = new Date('2026-10-06T11:30:00Z');

    it('formats the datetime in Europe/Istanbul by default (TR)', async () => {
      await service.sendBookingConfirmationSms(
        '05321112233',
        'MyBot',
        start,
        'AI/LLM Bootcamp',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('MyBot randevunuz 06/10 14:30 için onaylandı'),
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('AI/LLM Bootcamp'),
      );
    });

    it('formats the datetime in English when lang=en', async () => {
      await service.sendBookingConfirmationSms(
        '05321112233',
        'MyBot',
        start,
        'AI/LLM Bootcamp',
        'en',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Your MyBot appointment is confirmed for 06/10 14:30',
        ),
      );
    });

    it('honors an explicit timezone override (UTC)', async () => {
      await service.sendBookingConfirmationSms(
        '05321112233',
        'MyBot',
        start,
        'Class',
        'tr',
        'UTC',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('06/10 11:30'),
      );
    });

    it('routes through sendSms (tagged as "booking_confirmation")', async () => {
      await service.sendBookingConfirmationSms(
        '05321112233',
        'B',
        start,
        's',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would send booking_confirmation'),
      );
    });
  });

  // ---------------------------------------------------------------------
  // sendBookingReminderSms
  // ---------------------------------------------------------------------

  describe('sendBookingReminderSms', () => {
    // 2026-10-06 14:30 Europe/Istanbul as UTC
    const start = new Date('2026-10-06T11:30:00Z');

    it('produces the "tomorrow at HH:MM" wording for offset 1440 (TR)', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'MyBot',
        start,
        'AI/LLM Bootcamp',
        1440,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('MyBot randevunuzu hatırlatırız: yarın 14:30'),
      );
      // Full date NOT included for the "tomorrow" branch — recipient
      // already knows the day is tomorrow, only the time matters.
      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('06/10 14:30'),
      );
    });

    it('produces the "in 1 hour at HH:MM" wording for offset 60 (TR)', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'MyBot',
        start,
        'AI/LLM Bootcamp',
        60,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'MyBot randevunuz yaklaşıyor: 1 saat sonra 14:30',
        ),
      );
    });

    it('produces the English "tomorrow" variant when lang=en', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'MyBot',
        start,
        'Class',
        1440,
        'en',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Reminder: your MyBot appointment is tomorrow at 14:30',
        ),
      );
    });

    it('produces the English "1 hour" variant when lang=en', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'MyBot',
        start,
        'Class',
        60,
        'en',
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Reminder: your MyBot appointment is in 1 hour at 14:30',
        ),
      );
    });

    it('falls back to the generic "N hours" wording for unusual offsets (TR)', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'MyBot',
        start,
        'Class',
        180, // 3 hours
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('3 saat sonra'),
      );
      // Generic branch DOES include the full date so the recipient
      // knows exactly when — offset alone is ambiguous.
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('06/10 14:30'),
      );
    });

    it('routes through sendSms (tagged as "booking_reminder")', async () => {
      await service.sendBookingReminderSms(
        '05321112233',
        'B',
        start,
        's',
        60,
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Would send booking_reminder'),
      );
    });
  });
});
