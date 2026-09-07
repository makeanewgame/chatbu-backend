/**
 * Legal Slice 6b (2026-09-07): widget consent notices as CMS documents.
 *
 * Until now the visitor-facing consent copy lived in a hardcoded pack
 * registry (`src/lead/consent-text.constants.ts`) because a
 * `LegalDocumentContent` row carries only `title` + `bodyMarkdown`, while
 * a pack is a set of discrete fields. Slice 6 lifted the TR-source lock
 * off the CMS, which removed the original blocker; this module supplies
 * the missing half — a small, explicit contract for packing the three
 * LEGAL fields of a pack into one markdown body and getting them back
 * out.
 *
 * What belongs in the CMS (this contract) vs. what stays in the pack:
 *
 *   CMS (legal text, editable by an admin without a deploy):
 *     - title             → LegalDocumentContent.title
 *     - intro             → "## Intro" section
 *     - controllerNotice  → "## Controller" section  ({teamBusinessName})
 *     - checkboxLabel     → "## Consent" section     (the consent statement)
 *
 *   Pack (UI chrome — NOT legal text, must not be admin-editable):
 *     - continueButton, submitting, acceptedLabel, errorMessage
 *   Environment-derived, never authored:
 *     - privacyPolicyUrl, termsOfUseUrl (FRONTEND_URL + ?lng)
 *
 * The section headings are a fixed English contract regardless of the
 * content's own language — they are structure, not copy, and never reach
 * the visitor. `publishVersion` rejects a consent-notice version whose
 * servable contents don't satisfy it, so a broken body is caught at
 * publish time rather than silently degrading the widget.
 */

export const CONSENT_NOTICE_SLUG_PREFIX = 'privacy-notice-';

/** CMS slug holding the consent notice for a jurisdiction (gdpr, kvkk, …). */
export function consentNoticeSlug(jurisdiction: string): string {
  return `${CONSENT_NOTICE_SLUG_PREFIX}${jurisdiction}`;
}

export function isConsentNoticeSlug(slug: string): boolean {
  return slug.startsWith(CONSENT_NOTICE_SLUG_PREFIX);
}

/** The legal fields of a consent pack that the CMS owns. */
export interface ConsentNoticeFields {
  intro: string;
  controllerNotice: string;
  checkboxLabel: string;
}

// Canonical section headings, in the order formatConsentNotice emits them.
const SECTION_HEADINGS: { key: keyof ConsentNoticeFields; heading: string }[] = [
  { key: 'intro', heading: 'Intro' },
  { key: 'controllerNotice', heading: 'Controller' },
  { key: 'checkboxLabel', heading: 'Consent' },
];

const HEADING_LINE = /^\s*##\s+(.+?)\s*$/;

/**
 * Parse a consent-notice body back into its three legal fields.
 *
 * Returns null when ANY required section is missing or empty. Callers
 * treat that as "this document is not servable" and fall back to the
 * hardcoded pack WHOLESALE — never field-by-field. A partial merge would
 * resurrect the shown-vs-recorded divergence Slice 6 closed: the visitor
 * would read pack copy while the consent row recorded a CMS version
 * string. All-or-nothing keeps the two in step.
 */
export function parseConsentNotice(bodyMarkdown: string): ConsentNoticeFields | null {
  if (!bodyMarkdown) return null;

  const byHeading = new Map<string, string[]>();
  let current: string | null = null;

  for (const line of bodyMarkdown.split(/\r?\n/)) {
    const match = HEADING_LINE.exec(line);
    if (match) {
      current = match[1].trim().toLowerCase();
      if (!byHeading.has(current)) byHeading.set(current, []);
      continue;
    }
    if (current) byHeading.get(current)!.push(line);
  }

  const fields = {} as ConsentNoticeFields;
  for (const { key, heading } of SECTION_HEADINGS) {
    const body = byHeading.get(heading.toLowerCase())?.join('\n').trim();
    if (!body) return null;
    fields[key] = body;
  }
  return fields;
}

/** Render the three legal fields into the section contract above. */
export function formatConsentNotice(fields: ConsentNoticeFields): string {
  return SECTION_HEADINGS.map(
    ({ key, heading }) => `## ${heading}\n\n${fields[key].trim()}`,
  ).join('\n\n');
}

/**
 * Human-readable reason a consent-notice body is unservable, for the
 * publish-time 400. Returns null when the body is valid.
 */
export function describeConsentNoticeProblem(bodyMarkdown: string): string | null {
  if (parseConsentNotice(bodyMarkdown)) return null;
  const required = SECTION_HEADINGS.map(({ heading }) => `"## ${heading}"`).join(', ');
  return `A consent notice body must contain the sections ${required}, each with text below it.`;
}
