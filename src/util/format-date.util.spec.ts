import { formatNotificationDate } from './format-date.util';

describe('formatNotificationDate', () => {
  // Noon UTC — far from a date boundary in every locale zone below.
  const noonUtc = new Date('2026-09-03T12:00:00Z');

  it('uses day/month/year for Turkish', () => {
    expect(formatNotificationDate(noonUtc, 'tr')).toBe('03/09/2026');
  });

  it('uses month/day/year for English', () => {
    expect(formatNotificationDate(noonUtc, 'en')).toBe('09/03/2026');
  });

  it('treats every non-English locale as day/month/year', () => {
    for (const lang of ['de', 'es', 'fr', 'it', 'ru', 'ar', 'unknown']) {
      expect(formatNotificationDate(noonUtc, lang)).toBe('03/09/2026');
    }
  });

  it('defaults to English ordering when no locale is given', () => {
    expect(formatNotificationDate(noonUtc)).toBe('09/03/2026');
  });

  it('renders the time in the locale timezone when withTime is set', () => {
    // Istanbul = UTC+3 → 15:00
    expect(formatNotificationDate(noonUtc, 'tr', { withTime: true })).toBe(
      '03/09/2026 15:00',
    );
    // London = UTC+1 (BST) in September → 13:00
    expect(formatNotificationDate(noonUtc, 'en', { withTime: true })).toBe(
      '09/03/2026 13:00',
    );
    // Berlin = UTC+2 → 14:00
    expect(formatNotificationDate(noonUtc, 'de', { withTime: true })).toBe(
      '03/09/2026 14:00',
    );
  });

  it('rolls the date over when the locale timezone crosses midnight', () => {
    const lateUtc = new Date('2026-09-03T22:30:00Z');
    // Istanbul UTC+3 → 01:30 the next day
    expect(formatNotificationDate(lateUtc, 'tr', { withTime: true })).toBe(
      '04/09/2026 01:30',
    );
    // London BST UTC+1 → still the 3rd, 23:30
    expect(formatNotificationDate(lateUtc, 'en', { withTime: true })).toBe(
      '09/03/2026 23:30',
    );
  });

  it('unknown locales fall back to the English timezone', () => {
    expect(formatNotificationDate(noonUtc, 'xx', { withTime: true })).toBe(
      '03/09/2026 13:00',
    );
  });
});
