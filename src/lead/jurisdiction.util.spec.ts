import { resolveJurisdiction, resolveConsentLocale } from './jurisdiction.util';

describe('resolveJurisdiction', () => {
  it('maps GB → gdpr', () => {
    expect(resolveJurisdiction({ country: 'GB' })).toBe('gdpr');
  });

  it('maps DE → gdpr', () => {
    expect(resolveJurisdiction({ country: 'DE' })).toBe('gdpr');
  });

  it('maps TR → kvkk', () => {
    expect(resolveJurisdiction({ country: 'TR' })).toBe('kvkk');
  });

  it('maps US → ccpa', () => {
    expect(resolveJurisdiction({ country: 'US' })).toBe('ccpa');
  });

  it('maps AE → pdpl', () => {
    expect(resolveJurisdiction({ country: 'AE' })).toBe('pdpl');
  });

  it('maps SA → pdpl', () => {
    expect(resolveJurisdiction({ country: 'SA' })).toBe('pdpl');
  });

  it('falls through to generic for unmapped country like ZA', () => {
    expect(resolveJurisdiction({ country: 'ZA' })).toBe('generic');
  });

  it('accepts lowercase country codes', () => {
    expect(resolveJurisdiction({ country: 'de' })).toBe('gdpr');
    expect(resolveJurisdiction({ country: 'tr' })).toBe('kvkk');
  });

  it('country signal wins over bot default', () => {
    // A UK visitor on a bot that defaults to GDPR still gets GDPR — but
    // more importantly, a TR visitor on a GDPR-default bot still gets
    // KVKK because the phone country is the strongest signal.
    expect(
      resolveJurisdiction({ country: 'TR', botDefault: 'gdpr' }),
    ).toBe('kvkk');
  });

  it('bot default wins when country absent', () => {
    expect(resolveJurisdiction({ botDefault: 'gdpr' })).toBe('gdpr');
    expect(resolveJurisdiction({ botDefault: 'ccpa' })).toBe('ccpa');
  });

  it('parses browser locale region tag when country + bot default absent', () => {
    expect(resolveJurisdiction({ browserLocale: 'de-DE' })).toBe('gdpr');
    expect(resolveJurisdiction({ browserLocale: 'en-US' })).toBe('ccpa');
    expect(resolveJurisdiction({ browserLocale: 'tr-TR' })).toBe('kvkk');
    expect(resolveJurisdiction({ browserLocale: 'ar-AE' })).toBe('pdpl');
  });

  it('ignores browser locale without region tag', () => {
    // "en" alone gives no country hint → generic
    expect(resolveJurisdiction({ browserLocale: 'en' })).toBe('generic');
  });

  it('ignores invalid browser locale', () => {
    expect(resolveJurisdiction({ browserLocale: 'not-a-locale' })).toBe('generic');
    expect(resolveJurisdiction({ browserLocale: '' })).toBe('generic');
  });

  it('returns generic when every signal is absent', () => {
    expect(resolveJurisdiction({})).toBe('generic');
    expect(resolveJurisdiction({ country: null, botDefault: null, browserLocale: null })).toBe(
      'generic',
    );
  });

  it('priority: country > botDefault > browserLocale', () => {
    // country=TR (kvkk) beats botDefault=gdpr beats browserLocale=en-US (ccpa)
    expect(
      resolveJurisdiction({
        country: 'TR',
        botDefault: 'gdpr',
        browserLocale: 'en-US',
      }),
    ).toBe('kvkk');
    // no country: botDefault beats browserLocale
    expect(
      resolveJurisdiction({
        botDefault: 'gdpr',
        browserLocale: 'en-US',
      }),
    ).toBe('gdpr');
    // no country + no botDefault: browserLocale kicks in
    expect(
      resolveJurisdiction({
        browserLocale: 'en-US',
      }),
    ).toBe('ccpa');
  });
});

describe('resolveConsentLocale', () => {
  it('honors explicit locale when supported', () => {
    expect(
      resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'de' }),
    ).toBe('de');
    expect(
      resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'en' }),
    ).toBe('en');
  });

  it('strips language tag from explicit ("de-DE" → "de")', () => {
    expect(
      resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'de-DE' }),
    ).toBe('de');
  });

  it('falls to browser locale when explicit unsupported', () => {
    expect(
      resolveConsentLocale({
        jurisdiction: 'gdpr',
        explicit: 'zh',
        browserLocale: 'de-DE',
      }),
    ).toBe('de');
  });

  it('KVKK jurisdiction always renders in TR even when locale requests EN', () => {
    // Legal wording is Turkish — never render KVKK copy in English.
    expect(
      resolveConsentLocale({
        jurisdiction: 'kvkk',
        explicit: 'en',
        browserLocale: 'en-US',
      }),
    ).toBe('tr');
  });

  it('non-KVKK jurisdiction defaults to EN when no locale signal', () => {
    expect(resolveConsentLocale({ jurisdiction: 'gdpr' })).toBe('en');
    expect(resolveConsentLocale({ jurisdiction: 'generic' })).toBe('en');
    expect(resolveConsentLocale({ jurisdiction: 'ccpa' })).toBe('en');
  });

  it('honors all newly-supported EU locales (fr, it, es)', () => {
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'fr' })).toBe('fr');
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'it' })).toBe('it');
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'es' })).toBe('es');
  });

  it('accepts ru + ar as supported locales even without a jurisdiction pack', () => {
    // resolveConsentLocale returns the locale — pack lookup happens
    // separately via getConsentPack, which falls to (jurisdiction, en).
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'ru' })).toBe('ru');
    expect(resolveConsentLocale({ jurisdiction: 'pdpl', explicit: 'ar' })).toBe('ar');
  });

  it('unsupported locale (zh, pt, hi) falls to EN', () => {
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'zh' })).toBe('en');
    expect(resolveConsentLocale({ jurisdiction: 'gdpr', explicit: 'pt' })).toBe('en');
  });
});
