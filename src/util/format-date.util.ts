/**
 * Wall-clock timezone each mail locale is rendered in.
 *
 * Notification mails carry no explicit timezone label, so the displayed
 * time is localised to match the language of the mail: a Turkish mail
 * shows Istanbul time, an English mail shows UK time, and so on. Locales
 * without an entry fall back to the English zone.
 */
const LOCALE_TIME_ZONES: Record<string, string> = {
  tr: 'Europe/Istanbul',
  en: 'Europe/London',
  de: 'Europe/Berlin',
  es: 'Europe/Madrid',
  fr: 'Europe/Paris',
  it: 'Europe/Rome',
  ru: 'Europe/Moscow',
  ar: 'Asia/Riyadh',
};

/**
 * Formats a date for outbound mail notifications.
 *
 * Only the day/month ordering is locale-dependent, per product spec:
 *   - English (`en`) → month/day/year  e.g. `12/20/1982`
 *   - Turkish + every other locale → day/month/year  e.g. `20/12/1982`
 *
 * The wall-clock value is resolved in the locale's timezone
 * ({@link LOCALE_TIME_ZONES}), not the server timezone.
 *
 * Pass `withTime` for notifications that also show a clock time
 * (lead / handoff / feedback alerts). It is appended as `HH:mm` in
 * 24-hour form.
 */
export function formatNotificationDate(
  date: Date,
  lang: string = 'en',
  opts: { withTime?: boolean } = {},
): string {
  const timeZone = LOCALE_TIME_ZONES[lang] ?? LOCALE_TIME_ZONES.en;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...(opts.withTime
      ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }
      : {}),
  }).formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const day = part('day');
  const month = part('month');
  const year = part('year');

  const datePart =
    lang === 'en' ? `${month}/${day}/${year}` : `${day}/${month}/${year}`;

  if (!opts.withTime) return datePart;

  return `${datePart} ${part('hour')}:${part('minute')}`;
}
