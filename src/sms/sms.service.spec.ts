import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { BadRequestException } from '@nestjs/common';

import { SmsService, parsePhoneToE164, resolveOtpLang } from './sms.service';
import { NetgsmSmsProvider } from './providers/netgsm.provider';
import { TwilioSmsProvider } from './providers/twilio.provider';
import { TwilioWhatsAppProvider } from './providers/twilio-whatsapp.provider';
import { OtpDeliveryFallbackService } from './otp-delivery-fallback.service';

/**
 * Post-2026-08-13 tests: `SmsService` is a thin router that parses a
 * user-typed phone into `{e164, country}`, picks a provider based on the
 * country + `SMS_PROVIDER_STRATEGY` env, and delegates. Retry envelope
 * + NETGSM-specific error classification moved into `NetgsmSmsProvider`
 * and lives in `providers/netgsm.provider.spec.ts`.
 *
 * These tests focus on the routing decision, the parse-vs-legacy fallback,
 * and the counter's provider/country labels. Providers are mocked so we
 * can assert `sendSms` was called on the RIGHT provider with the RIGHT
 * shape without hitting HTTP or the Twilio SDK.
 */
describe('SmsService (router)', () => {
  let service: SmsService;
  let netgsm: { sendSms: jest.Mock; name: string };
  let twilio: { sendSms: jest.Mock; name: string };
  let whatsapp: { sendTemplate: jest.Mock; name: string };
  let otpFallback: { register: jest.Mock; take: jest.Mock };
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
    twilio = { name: 'twilio', sendSms: jest.fn().mockResolvedValue(undefined) };
    otpFallback = { register: jest.fn(), take: jest.fn() };
    whatsapp = {
      name: 'twilio_whatsapp',
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    smsCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: NetgsmSmsProvider, useValue: netgsm },
        { provide: TwilioSmsProvider, useValue: twilio },
        { provide: TwilioWhatsAppProvider, useValue: whatsapp },
        { provide: OtpDeliveryFallbackService, useValue: otpFallback },
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
      // strategy relies on to raise INVALID_PHONE_E164.
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
      expect(twilio.sendSms).not.toHaveBeenCalled();
    });

    it('ALSO routes US phones to NETGSM (strategy blocks routing)', async () => {
      // The whole point of `netgsm_only` — even if we parse a US number
      // the router does NOT delegate to Twilio yet. This is the prod
      // safety guarantee: Slice 1 ships without behavioural change.
      await service.sendSms('+14155551234', 'hello', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US' }),
      );
      expect(twilio.sendSms).not.toHaveBeenCalled();
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
      expect(twilio.sendSms).not.toHaveBeenCalled();
    });

    it('routes US phones to Twilio', async () => {
      await service.sendSms('+14155551234', 'hi', 'otp');
      expect(twilio.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'US', e164: '+14155551234' }),
      );
      expect(netgsm.sendSms).not.toHaveBeenCalled();
    });

    it('routes UK phones to Twilio', async () => {
      await service.sendSms('+447400900123', 'hi', 'otp');
      expect(twilio.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ country: 'GB' }),
      );
    });

    it('counter labels reflect the picked provider for US', async () => {
      await service.sendSms('+14155551234', 'hi', 'otp');
      expect(smsCounter.inc).toHaveBeenCalledWith({
        provider: 'twilio',
        context: 'otp',
        country: 'US',
        outcome: 'success',
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
      expect(twilio.sendSms).not.toHaveBeenCalled();
    });
  });

  describe('strategy default fallback', () => {
    it('falls back to netgsm_only when SMS_PROVIDER_STRATEGY is unset', async () => {
      await buildService(undefined);
      await service.sendSms('+14155551234', 'x', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalled(); // NETGSM, not Twilio
    });

    it('falls back to netgsm_only when SMS_PROVIDER_STRATEGY is garbage', async () => {
      process.env.SMS_PROVIDER_STRATEGY = 'blahblah';
      await buildService(undefined);
      // re-init with garbage in env
      process.env.SMS_PROVIDER_STRATEGY = 'blahblah';
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SmsService,
          { provide: NetgsmSmsProvider, useValue: netgsm },
          { provide: TwilioSmsProvider, useValue: twilio },
          { provide: TwilioWhatsAppProvider, useValue: whatsapp },
          { provide: OtpDeliveryFallbackService, useValue: otpFallback },
          { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
          { provide: 'PROM_METRIC_CHATBU_SMS_SEND_TOTAL', useValue: smsCounter },
        ],
      }).compile();
      service = module.get(SmsService);
      await service.sendSms('+14155551234', 'x', 'otp');
      expect(netgsm.sendSms).toHaveBeenCalled();
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

describe('resolveOtpLang — SMS template language', () => {
  it('conversation-language hint wins over phone country (diaspora case)', () => {
    // +49/+31 visitor chatting in Turkish must get a Turkish SMS.
    expect(resolveOtpLang('tr', 'DE')).toBe('tr');
    expect(resolveOtpLang('tr', 'NL')).toBe('tr');
  });

  it('non-tr hints fall to English until more templates ship (backlog)', () => {
    expect(resolveOtpLang('de', 'TR')).toBe('en');
    expect(resolveOtpLang('fr', 'FR')).toBe('en');
  });

  it('falls back to phone country without a hint', () => {
    expect(resolveOtpLang(undefined, 'TR')).toBe('tr');
    expect(resolveOtpLang('', 'TR')).toBe('tr');
    expect(resolveOtpLang(null, 'NL')).toBe('en');
  });

  it('defaults to English when neither signal exists', () => {
    expect(resolveOtpLang(undefined, null)).toBe('en');
  });

  it('sanitizes sloppy hints (case, locale suffix, whitespace)', () => {
    expect(resolveOtpLang(' TR ', 'DE')).toBe('tr');
    expect(resolveOtpLang('tr-TR', 'DE')).toBe('tr');
    expect(resolveOtpLang('TR-tr', 'DE')).toBe('tr');
  });
});

// ─── WhatsApp OTP channel (2026-09-07) ────────────────────────────────────
// SMS stays the default; WhatsApp is a second transport the VISITOR picks.
// The channel exists because SMS has a structural blind spot for travellers
// whose home SIM is switched off abroad.
describe('SmsService — WhatsApp OTP channel', () => {
  let service: SmsService;
  let netgsm: { sendSms: jest.Mock; name: string };
  let twilio: { sendSms: jest.Mock; name: string };
  let whatsapp: { sendTemplate: jest.Mock; name: string };
  let otpFallback: { register: jest.Mock; take: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let smsCounter: { inc: jest.Mock };

  const originalEnv = { ...process.env };

  async function build() {
    netgsm = { name: 'netgsm', sendSms: jest.fn().mockResolvedValue(undefined) };
    twilio = { name: 'twilio', sendSms: jest.fn().mockResolvedValue(undefined) };
    otpFallback = { register: jest.fn(), take: jest.fn() };
    whatsapp = {
      name: 'twilio_whatsapp',
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    smsCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: NetgsmSmsProvider, useValue: netgsm },
        { provide: TwilioSmsProvider, useValue: twilio },
        { provide: TwilioWhatsAppProvider, useValue: whatsapp },
        { provide: OtpDeliveryFallbackService, useValue: otpFallback },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
        { provide: 'PROM_METRIC_CHATBU_SMS_SEND_TOTAL', useValue: smsCounter },
      ],
    }).compile();
    service = module.get(SmsService);
  }

  const enableWhatsApp = () => {
    process.env.WHATSAPP_OTP_ENABLED = 'true';
    process.env.TWILIO_WHATSAPP_FROM = '+447414150634';
    process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_EN = 'HXen';
    process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_TR = 'HXtr';
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('defaults to SMS — an existing caller that passes no channel is untouched', async () => {
    enableWhatsApp();
    await build();

    await service.sendOtpSms('+905321112233', '123456', 'TestBot', 'tr');

    expect(netgsm.sendSms).toHaveBeenCalledTimes(1);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('sends the code as template variable 1, with no composed message body', async () => {
    enableWhatsApp();
    await build();

    await service.sendOtpSms('+31612345678', '654321', 'TestBot', 'en', 'whatsapp');

    expect(whatsapp.sendTemplate).toHaveBeenCalledWith({
      e164: '+31612345678',
      country: 'NL',
      contentSid: 'HXen',
      variables: { '1': '654321' },
      context: 'otp',
    });
    expect(netgsm.sendSms).not.toHaveBeenCalled();
    expect(twilio.sendSms).not.toHaveBeenCalled();
  });

  it('picks the template by language', async () => {
    enableWhatsApp();
    await build();

    await service.sendOtpSms('+905321112233', '111111', 'TestBot', 'tr', 'whatsapp');

    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ contentSid: 'HXtr' }),
    );
  });

  it('falls back to the English template when the language has none', async () => {
    process.env.WHATSAPP_OTP_ENABLED = 'true';
    process.env.TWILIO_WHATSAPP_FROM = '+447414150634';
    process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_EN = 'HXen';
    delete process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_TR;
    await build();

    await service.sendOtpSms('+905321112233', '111111', 'TestBot', 'tr', 'whatsapp');

    expect(whatsapp.sendTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ contentSid: 'HXen' }),
    );
  });

  it('refuses a WhatsApp send while the flag is off, rather than falling back to SMS', async () => {
    // Silent fallback would be worse than an error: the visitor asked for
    // WhatsApp precisely because SMS cannot reach them.
    delete process.env.WHATSAPP_OTP_ENABLED;
    await build();

    await expect(
      service.sendOtpSms('+31612345678', '654321', 'TestBot', 'en', 'whatsapp'),
    ).rejects.toThrow(BadRequestException);
    expect(netgsm.sendSms).not.toHaveBeenCalled();
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('rejects an unparsable phone before reaching the provider', async () => {
    enableWhatsApp();
    await build();

    await expect(
      service.sendOtpSms('not-a-phone', '654321', 'TestBot', 'en', 'whatsapp'),
    ).rejects.toThrow(BadRequestException);
    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
  });

  it('counts success and failure under the whatsapp provider label', async () => {
    enableWhatsApp();
    await build();

    await service.sendOtpSms('+31612345678', '1', 'TestBot', 'en', 'whatsapp');
    expect(smsCounter.inc).toHaveBeenCalledWith({
      provider: 'twilio_whatsapp',
      context: 'otp',
      country: 'NL',
      outcome: 'success',
    });

    whatsapp.sendTemplate.mockRejectedValueOnce(new Error('twilio down'));
    await expect(
      service.sendOtpSms('+31612345678', '2', 'TestBot', 'en', 'whatsapp'),
    ).rejects.toThrow('twilio down');
    expect(smsCounter.inc).toHaveBeenCalledWith({
      provider: 'twilio_whatsapp',
      context: 'otp',
      country: 'NL',
      outcome: 'failure',
    });
  });

  describe('whatsappOtpAvailable', () => {
    it('is false unless flag, sender and a template are all present', async () => {
      await build();
      expect(service.whatsappOtpAvailable()).toBe(false);

      process.env.WHATSAPP_OTP_ENABLED = 'true';
      expect(service.whatsappOtpAvailable()).toBe(false);

      process.env.TWILIO_WHATSAPP_FROM = '+447414150634';
      expect(service.whatsappOtpAvailable()).toBe(false);

      process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_EN = 'HXen';
      expect(service.whatsappOtpAvailable()).toBe(true);
    });
  });
});


describe('SmsService — WhatsApp booking confirmation + reminder', () => {
  let service: SmsService;
  let netgsm: { sendSms: jest.Mock; name: string };
  let twilio: { sendSms: jest.Mock; name: string };
  let whatsapp: { sendTemplate: jest.Mock; name: string };
  let otpFallback: { register: jest.Mock; take: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let smsCounter: { inc: jest.Mock };

  const originalEnv = { ...process.env };
  const startAt = new Date('2026-09-08T12:30:00+03:00');

  async function build() {
    netgsm = { name: 'netgsm', sendSms: jest.fn().mockResolvedValue(undefined) };
    twilio = { name: 'twilio', sendSms: jest.fn().mockResolvedValue(undefined) };
    otpFallback = { register: jest.fn(), take: jest.fn() };
    whatsapp = {
      name: 'twilio_whatsapp',
      sendTemplate: jest.fn().mockResolvedValue(undefined),
    };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    smsCounter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmsService,
        { provide: NetgsmSmsProvider, useValue: netgsm },
        { provide: TwilioSmsProvider, useValue: twilio },
        { provide: TwilioWhatsAppProvider, useValue: whatsapp },
        { provide: OtpDeliveryFallbackService, useValue: otpFallback },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
        { provide: 'PROM_METRIC_CHATBU_SMS_SEND_TOTAL', useValue: smsCounter },
      ],
    }).compile();
    service = module.get(SmsService);
  }

  const enableChannel = () => {
    process.env.WHATSAPP_OTP_ENABLED = 'true';
    process.env.TWILIO_WHATSAPP_FROM = '+447414150634';
  };
  const enableBookingTemplates = () => {
    process.env.TWILIO_WHATSAPP_BOOKING_CONFIRMATION_TEMPLATE_EN = 'HXconfEN';
    process.env.TWILIO_WHATSAPP_BOOKING_CONFIRMATION_TEMPLATE_TR = 'HXconfTR';
    process.env.TWILIO_WHATSAPP_BOOKING_REMINDER_TEMPLATE_EN = 'HXremEN';
    process.env.TWILIO_WHATSAPP_BOOKING_REMINDER_TEMPLATE_TR = 'HXremTR';
  };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('sends the confirmation as a template when the channel is whatsapp', async () => {
    enableChannel();
    enableBookingTemplates();
    await build();

    await service.sendBookingConfirmationSms(
      '+905065432731', 'TestBot', startAt, 'Saç bakımı', 'tr', 'Europe/Istanbul', 'whatsapp',
    );

    expect(netgsm.sendSms).not.toHaveBeenCalled();
    const call = whatsapp.sendTemplate.mock.calls[0][0];
    expect(call.contentSid).toBe('HXconfTR');
    expect(call.context).toBe('booking_confirmation');
    expect(call.variables['1']).toBe('TestBot');
    expect(call.variables['3']).toBe('Saç bakımı');
  });

  it('falls back to SMS when the booking template is not approved yet', async () => {
    // The channel is live for OTP but these templates clear Meta approval
    // on their own schedule. Dropping the confirmation would be a
    // regression against the SMS that works today.
    enableChannel();
    process.env.TWILIO_WHATSAPP_OTP_TEMPLATE_EN = 'HXotpEN';
    await build();

    await service.sendBookingConfirmationSms(
      '+905065432731', 'TestBot', startAt, 'Saç bakımı', 'tr', 'Europe/Istanbul', 'whatsapp',
    );

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(netgsm.sendSms).toHaveBeenCalledTimes(1);
  });

  it('never sends an empty template variable — Meta rejects the send', async () => {
    enableChannel();
    enableBookingTemplates();
    await build();

    await service.sendBookingConfirmationSms(
      '+905065432731', 'TestBot', startAt, '   ', 'tr', 'Europe/Istanbul', 'whatsapp',
    );

    expect(whatsapp.sendTemplate.mock.calls[0][0].variables['3']).toBe('-');
  });

  it('collapses every reminder offset shape into the one approved template', async () => {
    enableChannel();
    enableBookingTemplates();
    await build();

    for (const offset of [1440, 60, 180]) {
      await service.sendBookingReminderSms(
        '+905065432731', 'TestBot', startAt, 'Saç bakımı', offset, 'tr', 'Europe/Istanbul', 'whatsapp',
      );
    }

    const sids = whatsapp.sendTemplate.mock.calls.map((c: any[]) => c[0].contentSid);
    expect(sids).toEqual(['HXremTR', 'HXremTR', 'HXremTR']);

    // The offset-dependent phrasing rides in variable 2, not in three
    // separately approved templates.
    const phrases = whatsapp.sendTemplate.mock.calls.map((c: any[]) => c[0].variables['2']);
    expect(phrases[0]).toContain('yarın');
    expect(phrases[1]).toContain('1 saat sonra');
    expect(phrases[2]).toContain('3 saat sonra');
    expect(new Set(phrases).size).toBe(3);
  });

  it('leaves the SMS path byte-for-byte unchanged when no channel is passed', async () => {
    enableChannel();
    enableBookingTemplates();
    await build();

    await service.sendBookingConfirmationSms(
      '+905065432731', 'TestBot', startAt, 'Saç bakımı', 'tr', 'Europe/Istanbul',
    );
    await service.sendBookingReminderSms(
      '+905065432731', 'TestBot', startAt, 'Saç bakımı', 1440, 'tr', 'Europe/Istanbul',
    );

    expect(whatsapp.sendTemplate).not.toHaveBeenCalled();
    expect(netgsm.sendSms).toHaveBeenCalledTimes(2);
  });
});
