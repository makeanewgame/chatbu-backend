// Slice 3 (2026-08-20): consent text packs by (jurisdiction, locale).
//
// These are hardcoded packs — not sourced from the LegalDocument admin —
// because the LegalDocument admin UI is Turkish-source-locked
// (SOURCE_LOCALE='tr') and we want an English-first pack for GDPR without
// forcing a Turkish "source" translation dance for every legal iteration.
// A future refactor can lift these into the admin UI with per-slug source
// locale, but that's Slice 3D or later.
//
// The controller notice is templated — `{teamBusinessName}` is replaced
// at request time from the bot's team record. Chatbu is UK-based; the
// generic wording positions Chatbu Ltd (UK) as the processor acting on
// behalf of the bot owner (data controller). Legal review is required
// before prod ship, but the shape is compliant enough for dev canary.

export interface ConsentTextPack {
  jurisdiction: string;
  locale: string;
  version: string;
  title: string;
  intro: string;
  checkboxLabel: string;
  continueButton: string;
  submitting: string;
  acceptedLabel: string;
  errorMessage: string;
  // Rendered below the intro; `{teamBusinessName}` is interpolated at
  // request time. The processor identity (Chatbu) is baked in as a
  // literal to keep the copy consistent across bots.
  controllerNotice: string;
  privacyPolicyUrl: string;
  termsOfUseUrl: string;
}

const CHATBU_BASE = 'https://chatbu.io';

// GDPR — English (UK-based Chatbu, EU/UK visitors, and any English-
// speaking global visitor whose jurisdiction resolves to GDPR).
const GDPR_EN: ConsentTextPack = {
  jurisdiction: 'gdpr',
  locale: 'en',
  version: 'gdpr-en-v1',
  title: 'Privacy Notice and Terms of Use',
  intro:
    'To send you a verification code and forward your enquiry to the business you are chatting with, we need to process your phone number and the message you write here. Your consent is the legal basis for this processing under the UK GDPR / GDPR.',
  checkboxLabel: 'I have read and accept the Privacy Notice and Terms of Use.',
  continueButton: 'Accept and continue',
  submitting: 'Submitting…',
  acceptedLabel: 'Accepted',
  errorMessage: 'We could not save your consent. Please try again.',
  controllerNotice:
    'Chatbu Ltd (United Kingdom, chatbu.io) is the processor. {teamBusinessName} is the data controller and receives your enquiry. You may withdraw consent at any time via the Privacy Notice.',
  privacyPolicyUrl: `${CHATBU_BASE}/en/privacy-policy`,
  termsOfUseUrl: `${CHATBU_BASE}/en/terms-of-use`,
};

// GDPR — German. Same legal shape, translated for DE/AT/CH visitors.
const GDPR_DE: ConsentTextPack = {
  jurisdiction: 'gdpr',
  locale: 'de',
  version: 'gdpr-de-v1',
  title: 'Datenschutzhinweis und Nutzungsbedingungen',
  intro:
    'Damit wir Ihnen einen Bestätigungscode senden und Ihre Anfrage an das Unternehmen weiterleiten können, mit dem Sie chatten, müssen wir Ihre Telefonnummer und die von Ihnen verfasste Nachricht verarbeiten. Rechtsgrundlage dieser Verarbeitung ist Ihre Einwilligung nach der DSGVO.',
  checkboxLabel:
    'Ich habe den Datenschutzhinweis und die Nutzungsbedingungen gelesen und akzeptiere sie.',
  continueButton: 'Akzeptieren und fortfahren',
  submitting: 'Wird gesendet…',
  acceptedLabel: 'Akzeptiert',
  errorMessage: 'Ihre Einwilligung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.',
  controllerNotice:
    'Chatbu Ltd (Vereinigtes Königreich, chatbu.io) ist der Auftragsverarbeiter. {teamBusinessName} ist der Verantwortliche und empfängt Ihre Anfrage. Sie können Ihre Einwilligung jederzeit über den Datenschutzhinweis widerrufen.',
  privacyPolicyUrl: `${CHATBU_BASE}/en/privacy-policy`,
  termsOfUseUrl: `${CHATBU_BASE}/en/terms-of-use`,
};

// KVKK — Turkish. Preserves the pre-Slice-3 wording so legacy TR bots
// see zero behavioural change. Refers to Law No. 6698 explicitly.
const KVKK_TR: ConsentTextPack = {
  jurisdiction: 'kvkk',
  locale: 'tr',
  version: 'kvkk-tr-v1',
  title: 'Aydınlatma Metni ve Kullanım Şartları',
  intro:
    'Size doğrulama kodu göndermek ve talebinizi sohbet ettiğiniz işletmeye iletmek için telefon numaranızı ve buraya yazdığınız mesajı işlememiz gerekmektedir. Bu işleme, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında açık rızanıza dayanmaktadır.',
  checkboxLabel: 'Aydınlatma Metni ve Kullanım Şartları’nı okudum ve kabul ediyorum.',
  continueButton: 'Kabul et ve devam',
  submitting: 'Gönderiliyor…',
  acceptedLabel: 'Kabul edildi',
  errorMessage: 'Onayınızı kaydedemedik. Lütfen tekrar deneyin.',
  controllerNotice:
    'Chatbu Ltd (Birleşik Krallık, chatbu.io) veri işleyendir. {teamBusinessName} veri sorumlusudur ve talebinizi alır. Açık rızanızı Aydınlatma Metni üzerinden her zaman geri çekebilirsiniz.',
  privacyPolicyUrl: `${CHATBU_BASE}/tr/gizlilik-politikasi`,
  termsOfUseUrl: `${CHATBU_BASE}/tr/kullanim-sartlari`,
};

// Generic — English, jurisdiction-neutral fallback for markets without a
// specific pack. Uses "your local data protection law" as the legal
// basis phrasing so it holds up worldwide.
const GENERIC_EN: ConsentTextPack = {
  jurisdiction: 'generic',
  locale: 'en',
  version: 'generic-en-v1',
  title: 'Privacy Notice and Terms of Use',
  intro:
    'To send you a verification code and forward your enquiry to the business you are chatting with, we need to process your phone number and the message you write here. Your consent is the legal basis for this processing under applicable local data protection law.',
  checkboxLabel: 'I have read and accept the Privacy Notice and Terms of Use.',
  continueButton: 'Accept and continue',
  submitting: 'Submitting…',
  acceptedLabel: 'Accepted',
  errorMessage: 'We could not save your consent. Please try again.',
  controllerNotice:
    'Chatbu Ltd (United Kingdom, chatbu.io) is the processor. {teamBusinessName} is the data controller and receives your enquiry. You may withdraw consent at any time via the Privacy Notice.',
  privacyPolicyUrl: `${CHATBU_BASE}/en/privacy-policy`,
  termsOfUseUrl: `${CHATBU_BASE}/en/terms-of-use`,
};

// Registry keyed by "{jurisdiction}:{locale}". Fallback order handled by
// getConsentPack below.
const REGISTRY: Record<string, ConsentTextPack> = {
  'gdpr:en': GDPR_EN,
  'gdpr:de': GDPR_DE,
  'kvkk:tr': KVKK_TR,
  'generic:en': GENERIC_EN,
};

/**
 * Look up the consent text pack for a (jurisdiction, locale) request.
 *
 * Fallback chain when no exact pack exists:
 *   (jurisdiction, requestedLocale) → (jurisdiction, 'en') →
 *   ('generic', 'en')
 *
 * KVKK is the exception — it has no 'en' variant on purpose (a KVKK
 * consent in English would be legally questionable), so a KVKK request
 * with locale='en' still falls to KVKK-TR to preserve the correct
 * regulatory pack. Consumers that want English-language consent for a
 * Turkish visitor should resolve their jurisdiction to 'generic' first.
 */
export function getConsentPack(jurisdiction: string, locale: string): ConsentTextPack {
  const exact = REGISTRY[`${jurisdiction}:${locale}`];
  if (exact) return exact;

  // KVKK special case — never fall out of TR into EN.
  if (jurisdiction === 'kvkk') return KVKK_TR;

  const jurisdictionEn = REGISTRY[`${jurisdiction}:en`];
  if (jurisdictionEn) return jurisdictionEn;

  return GENERIC_EN;
}

/**
 * Interpolate `{teamBusinessName}` into the controllerNotice. Any other
 * placeholders can be added here as the notice text grows.
 */
export function renderControllerNotice(pack: ConsentTextPack, teamBusinessName: string): string {
  const safeName = teamBusinessName?.trim() || 'the business you are chatting with';
  return pack.controllerNotice.replace(/\{teamBusinessName\}/g, safeName);
}
