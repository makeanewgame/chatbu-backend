import { enOrTr, mailLocaleFromBillingCountry } from './mail-locale.util';

describe('enOrTr', () => {
  it('keeps Turkish', () => {
    expect(enOrTr('tr')).toBe('tr');
  });

  it('falls back to English for every other language', () => {
    for (const lang of ['en', 'de', 'es', 'fr', 'it', 'ru', 'ar', '', undefined, null]) {
      expect(enOrTr(lang as any)).toBe('en');
    }
  });
});

describe('mailLocaleFromBillingCountry', () => {
  it('maps Turkey to Turkish, case-insensitively', () => {
    expect(mailLocaleFromBillingCountry('TR')).toBe('tr');
    expect(mailLocaleFromBillingCountry('tr')).toBe('tr');
  });

  it('maps every other country and a missing address to English', () => {
    for (const country of ['US', 'GB', 'DE', 'FR', '', undefined, null]) {
      expect(mailLocaleFromBillingCountry(country as any)).toBe('en');
    }
  });
});
