import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { BadRequestException } from '@nestjs/common';

import { SmsService, parsePhoneToE164 } from './sms.service';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import { SnsSmsProvider } from './providers/sns.provider';

/**
 * Post-2026-08-13 tests: `SmsService` is a thin router that parses a
 * user-typed phone into `{e164, country}`, picks a provider based on the
 * country + `SMS_PROVIDER_STRATEGY` env, and delegates. Retry envelope
 * + provider-specific error classification live inside each provider
 * class (`providers/netgsm.provider.spec.ts`, provider-specific SNS
 * tests can be added if/when the AWS SDK mock surface grows).
 *
 * These tests focus on the routing decision, the parse-vs-legacy
 * fallback, and the counter's provider/country labels. Providers are
 * mocked so we can assert `sendSms` was called on the RIGHT provider
 * with the RIGHT shape without hitting HTTP or the SNS SDK.
 */
describe('SmsService (router)', () => {
  let service: SmsService;
  let netgsm: { sendSms: jest.Mock; name: string };
  let sns: { sendSms: jest.Mock; name: string };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let smsCounter: { inc: jest.Mock };

  const originalEnv = { ...process.env };

  async function buildService(strategy?: 'netgsm_only' | 'route_by_country') {
    if (strategy !== undefined) {
      process.env.SMS_PROVIDER_STRATEGY = strategy;
    } else {
      delete process.env.SMS_PROVIDER_STRATEGY;
    }
    netgsm = { name: 'netgsm', sendSms: jest.fn().mockResolvedValue(undefined) };
    sns = { name: 'sns', sendSms: jest.fn().mockResolvedValue(undefined) };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    smsCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: NetgsmSmsProvider, useValue: netgsm },
        { provide: SnsSmsProvider, useValue: sns },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
        { provide: 'PROM_METRIC_CHATBU_SMS_SEND_TOTAL', useValue: smsCounter },
      ],
    }).compile();
    service = module.get(SmsService);
  }

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------
  // parsePhoneToE164 — the seam every provider sees
  // ---------------------------------------------------------------------

  describe('parsePhoneToE164 helper', () => {
    it('parses a Turkish 0-prefixed phone using TR default country', () => {
      expect(parsePhoneToE164('0532 111 22 33')).toEqual({
        e164: '+905321112233',
        country: 'TR',
      });
    });

    it('parses a bare 10-digit TR mobile using TR default country', () => {
      expect(parsePhoneToE164('5321112233')).toEqual({
        e164: '+905321112233',
        country: 'TR',
      });
    });

    it('parses a `+90` international-shape TR phone', () => {
      expect(parsePhoneToE164('+90 532 111 22 33')).toEqual({
        e164: '+905321112233',
        country: 'TR',
      });
    });

    it('parses a US international phone', () => {
      expect(parsePhoneToE164('+1 415 555 12 34')).toEqual({
        e164: '+14155551234',
        country: 'US',
      });
    });

    it('parses a UK international phone', () => {
      // Ofcom-reserved test range (07700 900xxx) is 11 digits after
      // country code, but libphonenumber treats them as valid mobiles.
      // Using a real UK mobile pattern (+447400900123) instead.
      expect(parsePhoneToE164('+44 7400 900123')).toEqual({
        e164: '+447400900123',
        country: 'GB',
      });
    });

    it('returns null for garbage input', () => {
      expect(parsePhoneToE164('hello')).toBeNull();
      expect(parsePhoneToE164('')).toBeNull();
      expect(parsePhoneToE164(null as any)).toBeNull();
      expect(parsePhoneToE164(undefined as any)).toBeNull();
    });

    it('returns null for shape-valid but unparsable input (e.g. +99 999)', () => {
      // libphonenumber rejects unknown country codes / too-short national
      // parts. This is the negative test that Slice 2's route_by_country
      // strategy relies on to raise INVALID_PHONE_E164 once the international
      // provider is registered.
      expect(parsePhoneToE164('+99 999')).toBeNull();
    });
  });

  // ---------------------------------------------------------------------
  // Router — netgsm_only (default, prod baseline)
  // ---------------------------------------------------------------------

  describe('strategy=netgsm_only (default)', () => {
    beforeEach(() => buildService('netgsm_only'));

    it('routes TR phones to NETGSM', async () => {
      await service.sendSms('+905321112233', 'hello', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalledWith({
        e164: '+905321112233',
        country: 'TR',
        message: 'hello',
        context: 'otp',
      });
      expect(sns.sendSms).not.toHaveBeenCalled();
    });

    it('ALSO routes US phones to NETGSM (strategy blocks routing)', async () => {
      // The whole point of `netgsm_only` — even if we parse a US number
      // the router does NOT delegate elsewhere. This is the prod safety
      // guarantee: Slice 1 ships without behavioural change.
      await service.sendSms('+14155551234', 'hello', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US' }),
      );
      expect(sns.sendSms).not.toHaveBeenCalled();
    });

    it('legacy passthrough: unparsable phone falls back to NETGSM', async () => {
      // Pre-abstraction callers occasionally handed junk-shaped strings
      // to SmsService (e.g. NETGSM_MOCK dev flows, or LeadService
      // upstream not enforcing DTO shape). netgsm_only must preserve
      // that today-works behaviour so this refactor is a pure lift.
      await service.sendSms('99999', 'hi');
      expect(netgsm.sendSms).toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('legacy passthrough'),
      );
    });

    it('increments chatbu_sms_send_total with provider=netgsm on success', async () => {
      await service.sendSms('+905321112233', 'x', 'otp');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'netgsm',
        context: 'otp',
        country: 'TR',
        outcome: 'success',
      });
    });

    it('increments the counter with outcome=failure on provider throw', async () => {
      netgsm.sendSms.mockRejectedValueOnce(new Error('boom'));
      await expect(
        service.sendSms('+905321112233', 'x', 'otp'),
      ).rejects.toThrow('boom');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'netgsm',
        context: 'otp',
        country: 'TR',
        outcome: 'failure',
      });
    });
  });

  // ---------------------------------------------------------------------
  // Router — route_by_country (Slice 2 dev)
  // ---------------------------------------------------------------------

  describe('strategy=route_by_country', () => {
    beforeEach(() => buildService('route_by_country'));

    it('routes TR phones to NETGSM', async () => {
      await service.sendSms('+905321112233', 'hi', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'TR' }),
      );
      expect(sns.sendSms).not.toHaveBeenCalled();
    });

    it('routes US phones to SNS', async () => {
      await service.sendSms('+14155551234', 'hi', 'otp');
      expect(sns.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', e164: '+14155551234' }),
      );
      expect(netgsm.sendSms).not.toHaveBeenCalled();
    });

    it('routes UK phones to SNS', async () => {
      await service.sendSms('+447400900123', 'hi', 'otp');
      expect(sns.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'GB' }),
      );
      expect(netgsm.sendSms).not.toHaveBeenCalled();
    });

    it('counter labels reflect provider=sns for US', async () => {
      await service.sendSms('+14155551234', 'hi', 'otp');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'sns',
        context: 'otp',
        country: 'US',
        outcome: 'success',
      });
    });

    it('counter labels reflect provider=netgsm for TR under route_by_country', async () => {
      await service.sendSms('+905321112233', 'hi', 'otp');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'netgsm',
        context: 'otp',
        country: 'TR',
        outcome: 'success',
      });
    });

    it('increments outcome=failure with provider=sns when SNS throws', async () => {
      sns.sendSms.mockRejectedValueOnce(new Error('sns boom'));
      await expect(
        service.sendSms('+14155551234', 'hi', 'otp'),
      ).rejects.toThrow('sns boom');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'sns',
        context: 'otp',
        country: 'US',
        outcome: 'failure',
      });
    });

    it('rejects unparsable phone with INVALID_PHONE_E164', async () => {
      // Legacy passthrough is disabled under route_by_country — the
      // strict gate is what prevents an international non-TR string
      // from silently landing on NETGSM under the new strategy.
      await expect(
        service.sendSms('hello world', 'hi'),
      ).rejects.toThrow(BadRequestException);
      expect(netgsm.sendSms).not.toHaveBeenCalled();
      expect(sns.sendSms).not.toHaveBeenCalled();
    });
  });

  describe('strategy default fallback', () => {
    it('falls back to netgsm_only when SMS_PROVIDER_STRATEGY is unset', async () => {
      await buildService(undefined);
      await service.sendSms('+14155551234', 'x', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalled();
      expect(sns.sendSms).not.toHaveBeenCalled();
    });

    it('falls back to netgsm_only when SMS_PROVIDER_STRATEGY is garbage', async () => {
      process.env.SMS_PROVIDER_STRATEGY = 'blahblah';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          { provide: NetgsmSmsProvider, useValue: { name: 'netgsm', sendSms: jest.fn().mockResolvedValue(undefined) } },
          { provide: SnsSmsProvider, useValue: { name: 'sns', sendSms: jest.fn().mockResolvedValue(undefined) } },
          { provide: WINSTON_MODULE_PROVIDER, useValue: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } },
          { provide: 'PROM_METRIC_CHATBU_SMS_SEND_TOTAL', useValue: { inc: jest.fn() } },
        ],
      }).compile();
      const svc = module.get(SmsService);
      const netgsmProv = module.get(NetgsmSmsProvider) as any;
      const snsProv = module.get(SnsSmsProvider) as any;
      await svc.sendSms('+14155551234', 'x', 'otp');
      expect(netgsmProv.sendSms).toHaveBeenCalled();
      expect(snsProv.sendSms).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------
  // Wrapper methods — verify context tag + body composition unchanged
  // ---------------------------------------------------------------------

  describe('sendOtpSms', () => {
    beforeEach(() => buildService('netgsm_only'));

    it('composes the Turkish OTP body by default', async () => {
      await service.sendOtpSms('+905321112233', '123456', 'Test Bot');
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'otp',
          message: 'Test Bot doğrulama kodunuz: 123456. Kod 5 dakika geçerlidir.',
        }),
      );
    });

    it('composes the English OTP body when lang=en', async () => {
      await service.sendOtpSms('+905321112233', '123456', 'Test Bot', 'en');
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Your Test Bot verification code: 123456. Valid for 5 minutes.',
        }),
      );
    });
  });

  describe('sendBookingConfirmationSms', () => {
    beforeEach(() => buildService('netgsm_only'));
    // A UTC instant equivalent to 2026-10-06 14:30 Europe/Istanbul (UTC+3).
    const start = new Date('2026-10-06T11:30:00Z');

    it('formats the datetime in Europe/Istanbul by default (TR)', async () => {
      await service.sendBookingConfirmationSms(
        '+905321112233',
        'MyBot',
        start,
        'AI/LLM Bootcamp',
      );
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'booking_confirmation',
          message: expect.stringContaining('MyBot randevunuz 06/10 14:30 için onaylandı'),
        }),
      );
    });

    it('honors an explicit timezone override (UTC)', async () => {
      await service.sendBookingConfirmationSms(
        '+905321112233',
        'MyBot',
        start,
        'Class',
        'tr',
        'UTC',
      );
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('06/10 11:30'),
        }),
      );
    });
  });

  describe('sendBookingReminderSms', () => {
    beforeEach(() => buildService('netgsm_only'));
    const start = new Date('2026-10-06T11:30:00Z');

    it('produces the "tomorrow" wording for offset 1440 (TR)', async () => {
      await service.sendBookingReminderSms(
        '+905321112233',
        'MyBot',
        start,
        'Class',
        1440,
      );
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          context: 'booking_reminder',
          message: expect.stringContaining('MyBot randevunuzu hatırlatırız: yarın 14:30'),
        }),
      );
    });

    it('produces the "in 1 hour" wording for offset 60 (EN)', async () => {
      await service.sendBookingReminderSms(
        '+905321112233',
        'MyBot',
        start,
        'Class',
        60,
        'en',
      );
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Reminder: your MyBot appointment is in 1 hour at 14:30'),
        }),
      );
    });

    it('falls back to generic "N hours" wording for unusual offsets (TR)', async () => {
      await service.sendBookingReminderSms(
        '+905321112233',
        'MyBot',
        start,
        'Class',
        180,
      );
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('3 saat sonra'),
        }),
      );
    });
  });
});
