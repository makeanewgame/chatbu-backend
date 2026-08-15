import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { SNSClient, PublishCommand, PublishCommandOutput } from '@aws-sdk/client-sns';

import { SmsProvider } from './sms-provider.interface';

// Retry envelope — mirrors NETGSM (see netgsm.provider.ts for the sizing
// rationale). SNS `Publish` is usually snappy (<1s), but the same envelope
// keeps the MCP caller's 30s ceiling honoured across both providers so a
// slow transport can't stall the whole round-trip regardless of which one
// the router picked.
const PER_ATTEMPT_TIMEOUT_MS = 12000;
const RETRY_BACKOFF_MS = 3000;

// SNS `Publish` errors surface via the AWS SDK's typed exceptions. The
// `$metadata.httpStatusCode` field is the canonical HTTP status; `name`
// is the API error code (`Throttling`, `InvalidParameter`, ...). We
// classify on both: 5xx / throttling / network errors get one retry;
// 4xx / auth / malformed request skip the retry so a config bug isn't
// masked. This mirrors NetgsmSmsProvider.isTransientFailure exactly so
// the two providers are indistinguishable from the router's perspective.
const SNS_TRANSIENT_ERROR_NAMES = new Set([
  'ThrottlingException',
  'Throttling',
  'InternalError',
  'InternalErrorException',
  'ServiceUnavailable',
  'ServiceUnavailableException',
  'RequestTimeout',
  'RequestTimeoutException',
]);

/**
 * AWS SNS transport for non-TR phones. Registered alongside
 * `NetgsmSmsProvider` behind the `SmsProvider` interface; the router
 * (`SmsService.pickProvider`) picks one per send based on the parsed
 * phone's country + `SMS_PROVIDER_STRATEGY` env. See
 * `.claude/plans/this-is-a-example-ticklish-dove.md` "# ACTIVE —
 * International SMS OTP" for the full plan.
 *
 * Why SNS (and not a commercial SMS provider): reuses the existing
 * IRSA/IAM stack — no separate account, no compliance profile review,
 * no npm credential provisioning. The backend pod's service account
 * needs `sns:Publish` on `arn:aws:sns:*:*:*` (Terraform patch, separate
 * PR); the SDK picks up the pod's IRSA-issued credentials automatically.
 *
 * Message shape: `PhoneNumber` takes E.164 directly (leading `+`). No
 * per-provider wire-shape helper needed. `SMSType=Transactional`
 * requests the higher-reliability path (SNS charges the same but
 * prioritizes delivery). `SenderID` is honoured in countries that
 * accept alphanumeric senders (most of EU, some of APAC); the US
 * ignores it and falls back to a long code automatically.
 */
@Injectable()
export class SnsSmsProvider implements SmsProvider {
  readonly name = 'sns' as const;

  // Lazy singleton — instantiated on first send so a pod that never
  // routes to SNS (all-TR traffic under `netgsm_only`, or the interim
  // period before the sandbox → prod ticket clears) doesn't attempt
  // to resolve IRSA credentials at boot.
  private clientInstance: SNSClient | null = null;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  private client(): SNSClient {
    if (!this.clientInstance) {
      this.clientInstance = new SNSClient({
        region: process.env.AWS_REGION || 'eu-central-1',
      });
    }
    return this.clientInstance;
  }

  private isTransientFailure(err: any): boolean {
    const name = err?.name;
    if (typeof name === 'string' && SNS_TRANSIENT_ERROR_NAMES.has(name)) return true;
    const status = err?.$metadata?.httpStatusCode;
    if (typeof status === 'number' && status >= 500) return true;
    // Network-level errors surface as plain Error with `.code`.
    const code = err?.code;
    if (code === 'ECONNABORTED' || code === 'ETIMEDOUT') return true;
    if (code === 'ECONNRESET' || code === 'ENOTFOUND') return true;
    return false;
  }

  async sendSms(input: {
    e164: string;
    country: string;
    message: string;
    context: string;
  }): Promise<void> {
    const { e164, country, message, context } = input;

    // Dev/local escape hatch — mirrors NETGSM_MOCK. Prod ASLA
    // sets this. Slow-test flows (dev canary before the SNS
    // sandbox → prod ticket clears) can flip this to true to
    // exercise the router without spending real SNS credit or
    // needing a phone in the sandbox whitelist.
    if (process.env.SNS_MOCK?.toLowerCase() === 'true') {
      this.logger.info(
        `[SNS_MOCK] Would send ${context} to ${e164} (${country}): "${message}"`,
      );
      return;
    }

    const senderId = process.env.SNS_SENDER_ID || 'Chatbu';

    const command = new PublishCommand({
      PhoneNumber: e164,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
        'AWS.SNS.SMS.SenderID': {
          DataType: 'String',
          StringValue: senderId,
        },
      },
    });

    // Retry envelope — one retry on transient failure with a fixed
    // backoff, matches NETGSM shape. `withTimeout` guards each attempt
    // so a hung TCP connection cannot exceed PER_ATTEMPT_TIMEOUT_MS.
    const attempt = async (): Promise<PublishCommandOutput> => {
      return await this.withTimeout(
        this.client().send(command),
        PER_ATTEMPT_TIMEOUT_MS,
      );
    };

    let response: PublishCommandOutput;
    try {
      response = await attempt();
    } catch (firstErr: any) {
      if (!this.isTransientFailure(firstErr)) {
        this.logger.error(
          `[SNS] permanent fail sending ${context} to ${e164} (no retry): ${firstErr?.name || 'Error'} — ${firstErr?.message ?? firstErr}`,
        );
        throw firstErr;
      }
      this.logger.warn(
        `[SNS] transient fail sending ${context} to ${e164}, retrying in ${RETRY_BACKOFF_MS}ms: ${firstErr?.name || 'Error'} — ${firstErr?.message ?? firstErr}`,
      );
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS));
      try {
        response = await attempt();
        this.logger.info(`[SNS] recovered on retry sending ${context} to ${e164}`);
      } catch (secondErr: any) {
        this.logger.error(
          `[SNS] exhausted after 2 attempts sending ${context} to ${e164}: ${secondErr?.name || 'Error'} — ${secondErr?.message ?? secondErr}`,
        );
        throw secondErr;
      }
    }

    this.logger.info(
      `[SNS] ${context} sent to ${e164} (messageId=${response.MessageId ?? 'n/a'})`,
    );
  }

  // Race the SDK call against a fixed timer. The AWS SDK has its own
  // internal timeouts but they're per-HTTP-op (connect, socket, tls)
  // and can compound; a single hard ceiling per attempt makes the
  // retry envelope's total wall-clock predictable.
  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const err: any = new Error(`SNS Publish timed out after ${ms}ms`);
        err.code = 'ETIMEDOUT';
        reject(err);
      }, ms);
      promise.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
}
