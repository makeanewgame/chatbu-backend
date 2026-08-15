import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';

import { NetgsmSmsProvider } from './netgsm.provider';

/**
 * Retry envelope + NETGSM-specific classification tests (2026-08-13
 * moved from sms.service.spec.ts alongside the provider abstraction
 * extract). The behaviour is unchanged from the pre-refactor
 * `SmsService.sendSms` implementation — this suite is here as a
 * regression trap so any accidental change to the transient-vs-
 * permanent classifier or the two-attempt envelope is caught.
 *
 * All tests input an E.164 phone since that's the new contract every
 * provider sees (SmsService parses once, providers assume already-
 * normalized). NETGSM wire format is the plus-stripped `90XXXXXXXXXX`
 * which the provider derives internally.
 */
describe('NetgsmSmsProvider', () => {
  let provider: NetgsmSmsProvider;
  let http: { post: jest.Mock };
  let logger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };
  let counter: { inc: jest.Mock };

  const originalEnv = { ...process.env };

  beforeEach(async () => {
    http = { post: jest.fn() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
    counter = { inc: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NetgsmSmsProvider,
        { provide: HttpService, useValue: http },
        { provide: WINSTON_MODULE_PROVIDER, useValue: logger },
        { provide: 'PROM_METRIC_CHATBU_NETGSM_SEND_TOTAL', useValue: counter },
      ],
    }).compile();

    provider = module.get(NetgsmSmsProvider);
    process.env.NETGSM_MOCK = 'true';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  // ---------------------------------------------------------------------
  // Wire-shape + mock hatch
  // ---------------------------------------------------------------------

  it('strips + from E.164 into NETGSM 90XXXXXXXXXX before sending', async () => {
    await provider.sendSms({
      e164: '+905321112233',
      country: 'TR',
      message: 'hello',
      context: 'otp',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('905321112233'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('"hello"'),
    );
  });

  it('tags the log line with the provided context', async () => {
    await provider.sendSms({
      e164: '+905321112233',
      country: 'TR',
      message: 'x',
      context: 'my_flow',
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('Would send my_flow'),
    );
  });

  it('does NOT hit the HTTP client in mock mode', async () => {
    await provider.sendSms({
      e164: '+905321112233',
      country: 'TR',
      message: 'x',
      context: 'otp',
    });
    expect(http.post).not.toHaveBeenCalled();
  });

  it('throws when credentials are missing and mock is off', async () => {
    process.env.NETGSM_MOCK = 'false';
    delete process.env.NETGSM_USERNAME;
    delete process.env.NETGSM_PASSWORD;
    delete process.env.NETGSM_MSGHEADER;

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).rejects.toThrow(/SMS provider is not configured/);
  });

  // ---------------------------------------------------------------------
  // Success codes + retry envelope
  // ---------------------------------------------------------------------

  it('accepts NETGSM success code "00" (no retry needed)', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    http.post.mockReturnValue(
      of({ data: { code: '00', jobid: 'j1' } } as AxiosResponse),
    );

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).resolves.toBeUndefined();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'otp',
      outcome: 'success_on_first',
    });
  });

  it('throws when NETGSM returns a non-success code (after retry)', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => cb()) as any);
    http.post.mockReturnValue(
      of({ data: { code: '80', jobid: 'j1' } } as AxiosResponse),
    );

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).rejects.toThrow(/NETGSM rejected/);
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'otp',
      outcome: 'exhausted',
    });
  });

  it('propagates HTTP transport errors (bare Error, non-retryable)', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    http.post.mockReturnValue(throwError(() => new Error('timeout')));

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).rejects.toThrow('timeout');
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'otp',
      outcome: 'permanent_fail',
    });
  });

  it('retries once on ECONNABORTED and succeeds on the second attempt', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => cb()) as any);
    const timeoutErr: any = new Error('cancelled');
    timeoutErr.code = 'ECONNABORTED';
    http.post
      .mockReturnValueOnce(throwError(() => timeoutErr))
      .mockReturnValueOnce(of({ data: { code: '00', jobid: 'j2' } } as AxiosResponse));

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).resolves.toBeUndefined();
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'otp',
      outcome: 'success_on_retry',
    });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('transient fail'),
    );
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('recovered on retry'),
    );
  });

  it('retries once on HTTP 5xx and succeeds on the second attempt', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    jest.spyOn(global, 'setTimeout').mockImplementation(((cb: any) => cb()) as any);
    const serverErr: any = new Error('bad gateway');
    serverErr.response = { status: 502 };
    http.post
      .mockReturnValueOnce(throwError(() => serverErr))
      .mockReturnValueOnce(of({ data: { code: '00', jobid: 'j3' } } as AxiosResponse));

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'booking_confirmation',
      }),
    ).resolves.toBeUndefined();
    expect(http.post).toHaveBeenCalledTimes(2);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'booking_confirmation',
      outcome: 'success_on_retry',
    });
  });

  it('does NOT retry on HTTP 4xx (permanent — bad credentials / malformed)', async () => {
    process.env.NETGSM_MOCK = 'false';
    process.env.NETGSM_USERNAME = 'u';
    process.env.NETGSM_PASSWORD = 'p';
    process.env.NETGSM_MSGHEADER = 'h';
    const authErr: any = new Error('unauthorized');
    authErr.response = { status: 401 };
    http.post.mockReturnValueOnce(throwError(() => authErr));

    await expect(
      provider.sendSms({
        e164: '+905321112233',
        country: 'TR',
        message: 'x',
        context: 'otp',
      }),
    ).rejects.toThrow('unauthorized');
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(counter.inc).toHaveBeenCalledWith({
      context: 'otp',
      outcome: 'permanent_fail',
    });
  });

  // ---------------------------------------------------------------------
  // Provider name field — the router keys on this
  // ---------------------------------------------------------------------

  it('exposes name="netgsm" for router provider-picking', () => {
    expect(provider.name).toBe('netgsm');
  });
});
