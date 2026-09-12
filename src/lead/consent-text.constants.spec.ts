import {
  consentLegalUrls,
  getConsentChrome,
  getConsentPack,
  renderControllerNotice,
} from './consent-text.constants';

describe('getConsentPack', () => {
  it('returns GDPR-EN for (gdpr, en)', () => {
    const pack = getConsentPack('gdpr', 'en');
    expect(pack.jurisdiction).toBe('gdpr');
    expect(pack.locale).toBe('en');
    expect(pack.title).toBe('Privacy Notice and Terms of Use');
  });

  it('returns GDPR-DE for (gdpr, de)', () => {
    const pack = getConsentPack('gdpr', 'de');
    expect(pack.jurisdiction).toBe('gdpr');
    expect(pack.locale).toBe('de');
    expect(pack.title).toBe('Datenschutzhinweis und Nutzungsbedingungen');
  });

  it('returns KVKK-TR for (kvkk, tr)', () => {
    const pack = getConsentPack('kvkk', 'tr');
    expect(pack.jurisdiction).toBe('kvkk');
    expect(pack.locale).toBe('tr');
    expect(pack.title).toBe('Aydınlatma Metni ve Kullanım Şartları');
  });

  it('returns Generic-EN for (generic, en)', () => {
    const pack = getConsentPack('generic', 'en');
    expect(pack.jurisdiction).toBe('generic');
    expect(pack.locale).toBe('en');
  });

  it('(gdpr, pt) falls to (gdpr, en) — locale unsupported for jurisdiction', () => {
    // Portuguese GDPR would need legal review; not yet shipped.
    const pack = getConsentPack('gdpr', 'pt');
    expect(pack.jurisdiction).toBe('gdpr');
    expect(pack.locale).toBe('en');
  });

  it('falls unknown jurisdiction → generic-en', () => {
    const pack = getConsentPack('lgpd', 'en');
    expect(pack.jurisdiction).toBe('generic');
    expect(pack.locale).toBe('en');
  });

  it('returns the KVKK translations for (kvkk, en) and (kvkk, ru)', () => {
    const en = getConsentPack('kvkk', 'en');
    expect(en.jurisdiction).toBe('kvkk');
    expect(en.locale).toBe('en');
    expect(en.intro).toMatch(/Law No\. 6698/);
    const ru = getConsentPack('kvkk', 'ru');
    expect(ru.jurisdiction).toBe('kvkk');
    expect(ru.locale).toBe('ru');
    expect(ru.intro).toMatch(/6698/);
  });

  it('KVKK exists in every widget language', () => {
    for (const locale of ['tr', 'en', 'de', 'fr', 'it', 'es', 'ru', 'ar']) {
      const pack = getConsentPack('kvkk', locale);
      expect(pack.jurisdiction).toBe('kvkk');
      expect(pack.locale).toBe(locale);
      expect(pack.intro).toMatch(/6698/);
    }
  });

  it('KVKK without a translation for the locale falls to English, never to generic', () => {
    const pack = getConsentPack('kvkk', 'zh');
    expect(pack.jurisdiction).toBe('kvkk');
    expect(pack.locale).toBe('en');
  });

  it('returns GDPR-FR / GDPR-IT / GDPR-ES for matching locales', () => {
    expect(getConsentPack('gdpr', 'fr').locale).toBe('fr');
    expect(getConsentPack('gdpr', 'fr').title).toMatch(/confidentialité/i);
    expect(getConsentPack('gdpr', 'it').locale).toBe('it');
    expect(getConsentPack('gdpr', 'it').title).toMatch(/privacy/i);
    expect(getConsentPack('gdpr', 'es').locale).toBe('es');
    expect(getConsentPack('gdpr', 'es').title).toMatch(/privacidad/i);
  });

  it('returns CCPA-EN for (ccpa, en) with CCPA-specific wording', () => {
    const pack = getConsentPack('ccpa', 'en');
    expect(pack.jurisdiction).toBe('ccpa');
    expect(pack.locale).toBe('en');
    expect(pack.intro).toMatch(/CCPA|California/);
  });

  it('returns PDPL-EN for (pdpl, en) with Gulf-PDPL wording', () => {
    const pack = getConsentPack('pdpl', 'en');
    expect(pack.jurisdiction).toBe('pdpl');
    expect(pack.locale).toBe('en');
    expect(pack.intro).toMatch(/PDPL/);
  });

  it('(ccpa, es) falls to (ccpa, en) — locale unsupported for jurisdiction', () => {
    // Spanish CCPA would need California legal review; not shipped.
    const pack = getConsentPack('ccpa', 'es');
    expect(pack.jurisdiction).toBe('ccpa');
    expect(pack.locale).toBe('en');
  });

  it('returns PDPL-AR for (pdpl, ar) with Gulf-PDPL wording', () => {
    const pack = getConsentPack('pdpl', 'ar');
    expect(pack.jurisdiction).toBe('pdpl');
    expect(pack.locale).toBe('ar');
    expect(pack.intro).toMatch(/الإمارات/);
  });

  it('GDPR and generic cover Russian and Arabic', () => {
    for (const jurisdiction of ['gdpr', 'generic']) {
      for (const locale of ['ru', 'ar']) {
        const pack = getConsentPack(jurisdiction, locale);
        expect(pack.jurisdiction).toBe(jurisdiction);
        expect(pack.locale).toBe(locale);
      }
    }
    expect(getConsentPack('gdpr', 'ru').intro).toMatch(/GDPR/);
  });

  it('a language no jurisdiction covers falls to that jurisdiction in English', () => {
    const pack = getConsentPack('gdpr', 'zh');
    expect(pack.jurisdiction).toBe('gdpr');
    expect(pack.locale).toBe('en');
  });
});

describe('renderControllerNotice', () => {
  const pack = getConsentPack('gdpr', 'en');

  it('interpolates {teamBusinessName} into notice', () => {
    const rendered = renderControllerNotice(pack, 'Acme Ltd');
    expect(rendered).toContain('Acme Ltd');
    expect(rendered).not.toContain('{teamBusinessName}');
  });

  it('substitutes a neutral phrase when name is empty', () => {
    const rendered = renderControllerNotice(pack, '');
    expect(rendered).not.toContain('{teamBusinessName}');
    expect(rendered).toMatch(/the business/i);
  });

  it('substitutes a neutral phrase when name is whitespace-only', () => {
    const rendered = renderControllerNotice(pack, '   ');
    expect(rendered).not.toContain('{teamBusinessName}');
  });

  it('replaces every occurrence of the placeholder', () => {
    const doubled: any = {
      ...pack,
      controllerNotice: '{teamBusinessName} — {teamBusinessName}',
    };
    const rendered = renderControllerNotice(doubled, 'Foo');
    expect(rendered).toBe('Foo — Foo');
  });
});

// 2026-09-07: chrome is jurisdiction-independent. Resolving it per
// (jurisdiction, locale) produced half-translated cards — a Turkish
// visitor whose Accept-Language put them under CCPA got an all-English
// pack (there is no ccpa:tr) inside a Turkish widget UI.
describe('getConsentChrome', () => {
  it('returns the chrome of the requested language whatever the jurisdiction', () => {
    const tr = getConsentChrome('tr');
    expect(tr.continueButton).toBe(getConsentPack('kvkk', 'tr').continueButton);
    expect(tr.continueButton).not.toBe(getConsentPack('ccpa', 'en').continueButton);
  });

  it('covers German from the GDPR pack', () => {
    expect(getConsentChrome('de').continueButton).toBe(getConsentPack('gdpr', 'de').continueButton);
  });

  it('covers Russian and Arabic now that their packs exist', () => {
    expect(getConsentChrome('ru').continueButton).toBe(getConsentPack('kvkk', 'ru').continueButton);
    expect(getConsentChrome('ar').continueButton).toBe(getConsentPack('kvkk', 'ar').continueButton);
  });

  it('falls back to English for a language no pack covers', () => {
    expect(getConsentChrome('zh')).toEqual(
      expect.objectContaining({ continueButton: 'Accept and continue' }),
    );
  });

  it('carries only chrome — no legal text leaks into it', () => {
    expect(Object.keys(getConsentChrome('en')).sort()).toEqual([
      'acceptedLabel',
      'continueButton',
      'errorMessage',
      'submitting',
    ]);
  });
});

describe('consentLegalUrls', () => {
  it('points both links at the app for the given locale', () => {
    const urls = consentLegalUrls('de');
    expect(urls.privacyPolicyUrl).toContain('/privacy-policy?lng=de');
    expect(urls.termsOfUseUrl).toContain('/terms-of-service?lng=de');
  });
});
