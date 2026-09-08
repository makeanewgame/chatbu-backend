import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from '@nestjs/class-validator';

/**
 * Signup-abuse guard (2026-09). Throwaway-mailbox providers are the backbone
 * of automated signup abuse: each fake account needs a "working" inbox only
 * long enough to (optionally) grab the activation code. Blocking the best-known
 * providers at registration raises the cost of running the bot noticeably
 * without a paid reputation API.
 *
 * This is an allowlist-friendly denylist: unknown domains pass. Keep it short
 * and high-signal; extend from the abuse logs as new domains show up.
 */
export const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  '0-mail.com',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'anonaddy.com',
  'burnermail.io',
  'dispostable.com',
  'emailondeck.com',
  'fakeinbox.com',
  'getnada.com',
  'guerrillamail.com',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'harakirimail.com',
  'inboxbear.com',
  'mail-temp.com',
  'mail7.io',
  'mailcatch.com',
  'maildrop.cc',
  'mailern.com',
  'mailinator.com',
  'mailnesia.com',
  'mailsac.com',
  'mailtm.com',
  'mintemail.com',
  'moakt.com',
  'mohmal.com',
  'mytemp.email',
  'nada.email',
  'sharklasers.com',
  'spam4.me',
  'temp-mail.io',
  'temp-mail.org',
  'tempail.com',
  'tempinbox.com',
  'tempmail.com',
  'tempmail.dev',
  'tempmail.plus',
  'tempmailo.com',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trbvm.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
]);

export function isDisposableEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const at = email.lastIndexOf('@');
  if (at === -1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return true;
  // Also catch "foo.mailinator.com" style subdomains of a blocked domain.
  return [...DISPOSABLE_EMAIL_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}

@ValidatorConstraint({ name: 'isNotDisposableEmail', async: false })
class IsNotDisposableEmailConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return !isDisposableEmail(value);
  }

  defaultMessage(): string {
    return 'Disposable email addresses are not allowed';
  }
}

export function IsNotDisposableEmail(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsNotDisposableEmailConstraint,
    });
  };
}
