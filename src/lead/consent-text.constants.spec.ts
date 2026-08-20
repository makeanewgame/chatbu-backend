import { getConsentPack, renderControllerNotice } from './consent-text.constants';

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

  it('KVKK never falls to EN — (kvkk, en) stays as (kvkk, tr)', () => {
    // Legal wording is Turkish; English KVKK would be legally questionable.
    const pack = getConsentPack('kvkk', 'en');
    expect(pack.jurisdiction).toBe('kvkk');
    expect(pack.locale).toBe('tr');
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

  it('(pdpl, ar) falls to (pdpl, en) — Arabic PDPL needs native review', () => {
    const pack = getConsentPack('pdpl', 'ar');
    expect(pack.jurisdiction).toBe('pdpl');
    expect(pack.locale).toBe('en');
  });

  it('(gdpr, ru) falls to (gdpr, en) — Russian GDPR not shipped yet', () => {
    const pack = getConsentPack('gdpr', 'ru');
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
