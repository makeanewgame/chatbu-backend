import { Transform } from 'class-transformer';

/**
 * DTO field decorator: trims surrounding whitespace and lowercases the value
 * before validation runs. Applied to every email field so that
 * "  User@Example.com " and "user@example.com" resolve to the same account
 * across register, login, email change and password reset. `User.email` is a
 * unique column, so without this the same person could end up with two rows.
 */
export function NormalizeEmail(): PropertyDecorator {
  return Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
}
