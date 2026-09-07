import {
  consentNoticeSlug,
  describeConsentNoticeProblem,
  formatConsentNotice,
  isConsentNoticeSlug,
  parseConsentNotice,
} from './consent-notice.util';
import { listConsentPacks } from 'src/lead/consent-text.constants';

const FIELDS = {
  intro: 'We need your phone number to send a verification code.',
  controllerNotice: 'DATALONGA SOLUTIONS LTD is the processor. {teamBusinessName} is the controller.',
  checkboxLabel: 'I have read and accept the Privacy Notice.',
};

describe('consent notice slug', () => {
  it('namespaces a jurisdiction', () => {
    expect(consentNoticeSlug('gdpr')).toBe('privacy-notice-gdpr');
    expect(isConsentNoticeSlug('privacy-notice-kvkk')).toBe(true);
  });

  it('does not claim unrelated legal documents', () => {
    expect(isConsentNoticeSlug('privacy-policy')).toBe(false);
    expect(isConsentNoticeSlug('terms-of-service')).toBe(false);
    expect(isConsentNoticeSlug('dpa')).toBe(false);
  });
});

describe('formatConsentNotice / parseConsentNotice', () => {
  it('round-trips every field', () => {
    expect(parseConsentNotice(formatConsentNotice(FIELDS))).toEqual(FIELDS);
  });

  it('preserves the {teamBusinessName} placeholder for later interpolation', () => {
    const parsed = parseConsentNotice(formatConsentNotice(FIELDS));
    expect(parsed?.controllerNotice).toContain('{teamBusinessName}');
  });

  it('keeps multi-paragraph section bodies intact', () => {
    const multi = { ...FIELDS, intro: 'First paragraph.\n\nSecond paragraph.' };
    expect(parseConsentNotice(formatConsentNotice(multi))?.intro).toBe(
      'First paragraph.\n\nSecond paragraph.',
    );
  });

  it('accepts headings in any case — they are structure, not copy', () => {
    const body = '## intro\nA\n\n## CONTROLLER\nB\n\n## Consent\nC';
    expect(parseConsentNotice(body)).toEqual({
      intro: 'A',
      controllerNotice: 'B',
      checkboxLabel: 'C',
    });
  });

  it('ignores sections outside the contract', () => {
    const body = `${formatConsentNotice(FIELDS)}\n\n## Notes\nInternal remark, not rendered.`;
    expect(parseConsentNotice(body)).toEqual(FIELDS);
  });

  it('returns null when a section is missing', () => {
    const body = '## Intro\nA\n\n## Controller\nB';
    expect(parseConsentNotice(body)).toBeNull();
  });

  it('returns null when a section is present but empty', () => {
    const body = '## Intro\nA\n\n## Controller\n\n## Consent\nC';
    expect(parseConsentNotice(body)).toBeNull();
  });

  it('returns null for free-form markdown with no sections at all', () => {
    expect(parseConsentNotice('Just a paragraph of legal text.')).toBeNull();
    expect(parseConsentNotice('')).toBeNull();
  });
});

describe('describeConsentNoticeProblem', () => {
  it('is silent for a valid body', () => {
    expect(describeConsentNoticeProblem(formatConsentNotice(FIELDS))).toBeNull();
  });

  it('names the required sections so the admin can fix the body', () => {
    const problem = describeConsentNoticeProblem('## Intro\nA');
    expect(problem).toContain('## Intro');
    expect(problem).toContain('## Controller');
    expect(problem).toContain('## Consent');
  });
});

// Guard: the seeder builds the CMS documents from the shipped packs, so
// every pack must survive the round-trip — otherwise `npm run seed:legal`
// would create drafts that publishVersion then refuses.
describe('shipped consent packs satisfy the contract', () => {
  const packs = listConsentPacks();

  it('covers every jurisdiction the resolver can return', () => {
    const jurisdictions = new Set(packs.map((p) => p.jurisdiction));
    expect([...jurisdictions].sort()).toEqual(['ccpa', 'gdpr', 'generic', 'kvkk', 'pdpl']);
  });

  it.each(packs.map((p) => [p.version, p] as const))('%s round-trips', (_version, pack) => {
    const body = formatConsentNotice({
      intro: pack.intro,
      controllerNotice: pack.controllerNotice,
      checkboxLabel: pack.checkboxLabel,
    });
    expect(describeConsentNoticeProblem(body)).toBeNull();
    expect(parseConsentNotice(body)).toEqual({
      intro: pack.intro,
      controllerNotice: pack.controllerNotice,
      checkboxLabel: pack.checkboxLabel,
    });
  });
});
