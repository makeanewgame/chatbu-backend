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

  it("maps the owner's declared bot language when country + bot default absent", () => {
    expect(resolveJurisdiction({ botPrimaryLanguage: 'tr' })).toBe('kvkk');
    expect(resolveJurisdiction({ botPrimaryLanguage: 'de' })).toBe('gdpr');
    expect(resolveJurisdiction({ botPrimaryLanguage: 'fr' })).toBe('gdpr');
    expect(resolveJurisdiction({ botPrimaryLanguage: 'it' })).toBe('gdpr');
    expect(resolveJurisdiction({ botPrimaryLanguage: 'es' })).toBe('gdpr');
  });

  it('maps the language the widget renders in when the bot declares none', () => {
    expect(resolveJurisdiction({ widgetLocale: 'tr' })).toBe('kvkk');
    expect(resolveJurisdiction({ widgetLocale: 'tr-TR' })).toBe('kvkk');
    expect(resolveJurisdiction({ widgetLocale: 'de' })).toBe('gdpr');
  });

  it('English is not a jurisdiction signal — UK, US, IE and every "English UI" browser share it', () => {
    expect(resolveJurisdiction({ botPrimaryLanguage: 'en' })).toBe('generic');
    expect(resolveJurisdiction({ widgetLocale: 'en' })).toBe('generic');
    // The region tag is a browser default, not a location: a Turkish
    // visitor's Chrome sends `en-US` too. It must never pick CCPA.
    expect(resolveJurisdiction({ widgetLocale: 'en-US' })).toBe('generic');
    expect(resolveJurisdiction({ botPrimaryLanguage: 'en-US' })).toBe('generic');
  });

  it('languages without a language-bound regime fall through to generic', () => {
    expect(resolveJurisdiction({ widgetLocale: 'ru' })).toBe('generic');
    expect(resolveJurisdiction({ widgetLocale: 'ar' })).toBe('generic');
    expect(resolveJurisdiction({ widgetLocale: 'not-a-locale' })).toBe('generic');
    expect(resolveJurisdiction({ widgetLocale: '' })).toBe('generic');
  });

  it('returns generic when every signal is absent', () => {
    expect(resolveJurisdiction({})).toBe('generic');
    expect(
      resolveJurisdiction({
        country: null,
        botDefault: null,
        botPrimaryLanguage: null,
        widgetLocale: null,
      }),
    ).toBe('generic');
  });

  it('priority: country > botDefault > botPrimaryLanguage > widgetLocale', () => {
    // country=US (ccpa) beats every language signal
    expect(
      resolveJurisdiction({
        country: 'US',
        botDefault: 'gdpr',
        botPrimaryLanguage: 'tr',
        widgetLocale: 'tr',
      }),
    ).toBe('ccpa');
    // no country: botDefault beats the languages
    expect(
      resolveJurisdiction({
        botDefault: 'gdpr',
        botPrimaryLanguage: 'tr',
        widgetLocale: 'tr',
      }),
    ).toBe('gdpr');
    // no country + no botDefault: the owner's bot language beats the
    // visitor's widget language — the notice names the owner's business
    // as the data controller
    expect(
      resolveJurisdiction({
        botPrimaryLanguage: 'tr',
        widgetLocale: 'de',
      }),
    ).toBe('kvkk');
    // owner language carries no regime: the widget language decides
    expect(
      resolveJurisdiction({
        botPrimaryLanguage: 'en',
        widgetLocale: 'tr',
      }),
    ).toBe('kvkk');
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
