import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from '@nestjs/class-validator';

/**
 * Signup-abuse guard (2026-09).
 *
 * Bots were registering with the display name set to spam / phishing copy
 * ("Claim 70K Lira - Your Key is One Tap Away -> https://bit.ly/xxxx") purely
 * so the activation email — which greets the recipient by `name`
 * ("Merhaba {{fullname}},") — would carry that payload to an arbitrary `to:`
 * address the attacker also controls. That burns our SES sender reputation and
 * fills the DB with junk User/Team rows.
 *
 * A real person's name never contains a URL, a line break, an invisible
 * control character or a wall of emoji, so we reject those outright. This is a
 * heuristic, deliberately lenient on the "real name" side.
 */

const URL_LIKE =
  /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|xyz|ru|link|info|shop|store|online|site|club|top|vip|live|app|me|biz|pro)\b|bit\.ly|t\.me|wa\.me|tinyurl|cutt\.ly)/i;

const EMOJI = /\p{Extended_Pictographic}/gu;
const HAS_LETTER = /\p{L}/u;
const LONG_DIGIT_RUN = /\d{5,}/;

function hasControlOrInvisibleChar(value: string): boolean {
  for (const char of value) {
    const code = char.codePointAt(0)!;
    // C0 controls + DEL.
    if (code <= 0x1f || code === 0x7f) return true;
    // Zero-width space/joiner/non-joiner, LTR/RTL marks.
    if (code >= 0x200b && code <= 0x200f) return true;
    // Bidi embedding / override / isolate controls.
    if (code >= 0x202a && code <= 0x202e) return true;
    if (code >= 0x2066 && code <= 0x2069) return true;
    // Word joiner + BOM / zero-width no-break space.
    if (code === 0x2060 || code === 0xfeff) return true;
  }
  return false;
}

export function looksLikeSpamName(raw: unknown): boolean {
  if (typeof raw !== 'string') return true;

  const value = raw.trim();

  if (value.length < 2 || value.length > 120) return true;
  if (URL_LIKE.test(value)) return true;
  if (hasControlOrInvisibleChar(value)) return true;

  // A couple of emoji in a name is fine; a decorative wall is not.
  if ((value.match(EMOJI) || []).length > 3) return true;

  // Must contain at least one letter in some script. "$$$ 70.000 $$$" has none.
  if (!HAS_LETTER.test(value)) return true;

  // Long digit runs (phone numbers, "70000 TL") don't belong in a display name.
  if (LONG_DIGIT_RUN.test(value)) return true;

  return false;
}

@ValidatorConstraint({ name: 'isHumanName', async: false })
class IsHumanNameConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return !looksLikeSpamName(value);
  }

  defaultMessage(): string {
    return 'Name contains disallowed content';
  }
}

export function IsHumanName(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (object: object, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      validator: IsHumanNameConstraint,
    });
  };
}
