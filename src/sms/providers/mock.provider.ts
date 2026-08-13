import { SmsProvider } from './sms-provider.interface';

/**
 * In-process test-only provider. Records every send call in `.sends`
 * so unit tests can assert on the router's provider-picking decision
 * without pulling in `require('twilio')` or `HttpService` mocks. Also
 * useful for a smoke-test deployment that wants to exercise the
 * router without any real transport wired up.
 *
 * NEVER wire this class into production DI — it is unregistered in
 * `SmsModule` on purpose. Tests instantiate it directly.
 */
export class MockSmsProvider implements SmsProvider {
  readonly name = 'mock' as const;

  public sends: Array<{
    e164: string;
    country: string;
    message: string;
    context: string;
  }> = [];

  // Optional per-call failure injection so tests can exercise the
  // outer error surfaces (LeadService → sentinel translation, etc.)
  // without mocking a real provider's failure modes.
  public shouldFail: Error | null = null;

  async sendSms(input: {
    e164: string;
    country: string;
    message: string;
    context: string;
  }): Promise<void> {
    if (this.shouldFail) {
      throw this.shouldFail;
    }
    this.sends.push(input);
  }
}
