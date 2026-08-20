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

  it('falls (gdpr, fr) → (gdpr, en) — locale unsupported for jurisdiction', () => {
    const pack = getConsentPack('gdpr', 'fr');
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
