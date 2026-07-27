import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

const NETGSM_SEND_URL = 'https://api.netgsm.com.tr/sms/rest/v2/send';

// NETGSM v2/send returns HTTP 200 even on a logical failure - the real
// outcome lives in the JSON body's `code` field. "00" and "01" are the only
// success codes (message accepted / queued); anything else is a provider or
// account error (bad credentials, unapproved msgheader, IYS filter reject,
// insufficient credit, etc). Never treat HTTP 200 alone as success.
const NETGSM_SUCCESS_CODES = new Set(['00', '01']);

// Turkish mobile numbers only, matching NETGSM's expected `90XXXXXXXXXX`
// (country code, no leading zero, no '+'). Confirm exact formatting
// requirements against NETGSM's own docs / a real test send before go-live.
function normalizeTurkishPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('90') && digits.length === 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 11) {
    return `90${digits.slice(1)}`;
  }
  if (digits.length === 10) {
    return `90${digits}`;
  }
  return digits;
}

@Injectable()
export class SmsService {
  constructor(
    private readonly httpService: HttpService,
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) { }

  /**
   * Send a 6-digit OTP over SMS via NETGSM. Throws on any failure - callers
   * (LeadService) must catch and record it, mirroring the same fix already
   * applied to every MailService method added after the original
   * sendRegisterMail (which swallowed errors silently).
   */
  async sendOtpSms(phone: string, code: string, botName: string, lang: 'tr' | 'en' = 'tr'): Promise<void> {
    const username = process.env.NETGSM_USERNAME;
    const password = process.env.NETGSM_PASSWORD;
    const msgheader = process.env.NETGSM_MSGHEADER;

    if (!username || !password || !msgheader) {
      this.logger.error('NETGSM credentials are not configured (NETGSM_USERNAME/NETGSM_PASSWORD/NETGSM_MSGHEADER)');
      throw new InternalServerErrorException('SMS provider is not configured');
    }

    const to = normalizeTurkishPhone(phone);
    const message =
      lang === 'en'
        ? `Your ${botName} verification code: ${code}. Valid for 5 minutes.`
        : `${botName} doğrulama kodunuz: ${code}. Kod 5 dakika geçerlidir.`;

    const basicAuth = Buffer.from(`${username}:${password}`).toString('base64');

    try {
      const response = await firstValueFrom(
        this.httpService.post(
          NETGSM_SEND_URL,
          {
            msgheader,
            encoding: 'TR',
            iysfilter: '0',
            partnercode: '',
            messages: [{ msg: message, no: to }],
          },
          {
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${basicAuth}`,
            },
            timeout: 10000,
          },
        ),
      );

      const code_ = response.data?.code;
      if (!NETGSM_SUCCESS_CODES.has(code_)) {
        throw new Error(`NETGSM rejected the message (code=${code_})`);
      }

      this.logger.info(`OTP SMS sent to ${to} via NETGSM (jobid=${response.data?.jobid ?? 'n/a'})`);
    } catch (error) {
      this.logger.error(`Error sending OTP SMS to ${to} via NETGSM:`, error);
      throw error;
    }
  }
}
