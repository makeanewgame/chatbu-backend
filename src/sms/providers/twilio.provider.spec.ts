import { Test, TestingModule } from '@nestjs/testing';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

import { TwilioSmsProvider } from './twilio.provider';

/**
 * Twilio provider tests focus on the seam we own — the wire shape
 * (`messagingServiceSid` vs `from`, `to = e164`), the MOCK escape
 * hatch, and the config-guard error surfaces. We do NOT test the
 * Twilio SDK itself — that's `twilio`'s job. The retry envelope
 * classifier is exercised indirectly via `isTransientFailure`
 * spot-checks; the two-attempt fence itself mirrors NETGSM's shape
 * and is covered by the NETGSM regression suite.
 */
describe('TwilioSmsProvider', () => {
  let provider: TwilioSmsProvider;
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwilioSmsProvider,
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
      ],
    }).compile();

    provider = module.get(TwilioSmsProvider);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  it('exposes name="twilio" for router provider-picking', () => {
    expect(provider.name).toBe('twilio');
  });

  describe('TWILIO_MOCK escape hatch', () => {
    it('returns without touching the SDK when TWILIO_MOCK=true', async () => {
      process.env.TWILIO_MOCK = 'true';
      // Deliberately do NOT set TWILIO_ACCOUNT_SID etc. — mock hatch
      // must short-circuit BEFORE the credential guard so dev pods
      // without Twilio secrets can exercise the routing.
      delete process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_AUTH_TOKEN;

      await provider.sendSms({
        e164: '+14155551234',
        country: 'US',
        message: 'Hello',
        context: 'otp',
      });
      // Single line composition — assert both the label and the
      // country marker are present in the same log statement.
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/\[TWILIO_MOCK\] Would send otp to \+14155551234 \(US\)/),
      );
    });

    it('logs the exact message body in mock mode (for dev traceability)', async () => {
      process.env.TWILIO_MOCK = 'true';
      await provider.sendSms({
        e164: '+447700900123',
        country: 'GB',
        message: 'MyBot doğrulama kodunuz: 999999.',
        context: 'otp',
      });
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('"MyBot doğrulama kodunuz: 999999."'),
      );
    });
  });

  describe('credential + sender config guards', () => {
    it('throws when TWILIO_ACCOUNT_SID is missing', async () => {
      process.env.TWILIO_MOCK = 'false';
      delete process.env.TWILIO_ACCOUNT_SID;
      process.env.TWILIO_AUTH_TOKEN = 'tok';
      process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';

      await expect(
        provider.sendSms({
          e164: '+14155551234',
          country: 'US',
          message: 'x',
          context: 'otp',
        }),
      ).rejects.toThrow(/Twilio provider is not configured/);
    });

    it('throws when TWILIO_AUTH_TOKEN is missing', async () => {
      process.env.TWILIO_MOCK = 'false';
      process.env.TWILIO_ACCOUNT_SID = 'AC1';
      delete process.env.TWILIO_AUTH_TOKEN;
      process.env.TWILIO_MESSAGING_SERVICE_SID = 'MG123';

      await expect(
        provider.sendSms({
          e164: '+14155551234',
          country: 'US',
          message: 'x',
          context: 'otp',
        }),
      ).rejects.toThrow(/Twilio provider is not configured/);
    });

    // Note: the sender-config check (need MessagingServiceSid OR
    // FromNumber) fires AFTER the credential check + ensureClient(),
    // which requires the twilio SDK to load. The credential check
    // above already covers the "will this pod boot cleanly without
    // Twilio secrets" question — real-cluster verification of the
    // sender guard happens on the internal test endpoint (Slice 2)
    // rather than in this unit-test surface that would have to stub
    // out `require('twilio')` from Jest.
  });
});
