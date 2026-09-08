import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { TurnstileGuard } from './turnstile.guard';

const ctxWithBody = (body: any): ExecutionContext =>
  ({
    switchToHttp: () => ({
      getRequest: () => ({ body, headers: {}, socket: {} }),
    }),
  }) as unknown as ExecutionContext;

const makeGuard = (secret?: string) => {
  const config = { get: (k: string) => (k === 'TURNSTILE_SECRET_KEY' ? secret : undefined) };
  const logger = { warn: jest.fn(), error: jest.fn() };
  return new TurnstileGuard(config as any, logger as any);
};

describe('TurnstileGuard', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is inert when no secret key is configured', async () => {
    const guard = makeGuard(undefined);
    await expect(guard.canActivate(ctxWithBody({}))).resolves.toBe(true);
  });

  it('rejects a request with no token when enabled', async () => {
    const guard = makeGuard('secret');
    await expect(guard.canActivate(ctxWithBody({}))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects when Cloudflare says the token is invalid', async () => {
    const guard = makeGuard('secret');
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ json: async () => ({ success: false, 'error-codes': ['invalid-input-response'] }) } as any);
    await expect(
      guard.canActivate(ctxWithBody({ turnstileToken: 'bad' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('passes when Cloudflare accepts the token', async () => {
    const guard = makeGuard('secret');
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ json: async () => ({ success: true }) } as any);
    await expect(
      guard.canActivate(ctxWithBody({ turnstileToken: 'good' })),
    ).resolves.toBe(true);
  });

  it('fails open when Cloudflare is unreachable', async () => {
    const guard = makeGuard('secret');
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network down'));
    await expect(
      guard.canActivate(ctxWithBody({ turnstileToken: 'whatever' })),
    ).resolves.toBe(true);
  });
});
