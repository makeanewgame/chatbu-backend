import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

const SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileVerifyResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
}

/**
 * Cloudflare Turnstile verification for the public, unauthenticated auth
 * endpoints that trigger an outbound email (register, lost-password,
 * resend-verification). Signup abuse (2026-09) used these as an open email
 * relay; the per-IP throttle + name validation raised the cost, this closes
 * the door on scripted abuse.
 *
 * Feature-flagged: with no TURNSTILE_SECRET_KEY configured the guard is inert,
 * so the endpoints keep working before the key is provisioned and the key can
 * be blanked as an emergency kill switch.
 *
 * The client sends the token as `turnstileToken` in the JSON body (the widget's
 * own field name `cf-turnstile-response` is also accepted).
 */
@Injectable()
export class TurnstileGuard implements CanActivate {
  private warnedMissingKey = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = this.config.get<string>('TURNSTILE_SECRET_KEY');
    if (!secret) {
      if (!this.warnedMissingKey) {
        this.warnedMissingKey = true;
        this.logger.warn(
          'TURNSTILE_SECRET_KEY not set — captcha verification is disabled',
        );
      }
      return true;
    }

    const req = context.switchToHttp().getRequest();
    const token: unknown =
      req.body?.turnstileToken ?? req.body?.['cf-turnstile-response'];

    if (typeof token !== 'string' || !token.trim()) {
      throw new ForbiddenException('Captcha verification required');
    }

    const ip =
      ((req.headers?.['x-forwarded-for'] as string) ?? '')
        .split(',')[0]
        .trim() ||
      req.socket?.remoteAddress ||
      undefined;

    let data: TurnstileVerifyResponse;
    try {
      const form = new URLSearchParams();
      form.append('secret', secret);
      form.append('response', token);
      if (ip) form.append('remoteip', ip);

      const res = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: form,
        signal: AbortSignal.timeout(5000),
      });
      data = (await res.json()) as TurnstileVerifyResponse;
    } catch (err) {
      // Cloudflare unreachable / timed out. Fail open: a transient CF outage
      // must not take down our signup. Throttle + name validation still apply.
      this.logger.error('Turnstile siteverify request failed, allowing request', {
        error: err instanceof Error ? err.message : String(err),
      });
      return true;
    }

    if (!data.success) {
      this.logger.warn('Turnstile verification rejected', {
        errorCodes: data['error-codes'],
        ip,
      });
      throw new ForbiddenException('Captcha verification failed');
    }

    return true;
  }
}
