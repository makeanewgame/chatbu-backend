import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const SUPPORTED_LOCALES = ['tr', 'en', 'de', 'fr', 'it', 'ru', 'ar', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Default source locale for documents that don't declare one — kept 'tr'
// because every document created before Slice 6 (2026-09-06) was authored
// Turkish-first. New documents can pick any supported locale as source
// via CreateLegalDocumentDto.sourceLocale.
export const SOURCE_LOCALE: SupportedLocale = 'tr';

// DPA (Slice 7): team-level Data Processing Agreement acceptance — only a
// TEAM_OWNER may record it, enforced in LegalDocumentService.recordAcceptance.
export const ACCEPTANCE_CONTEXTS = ['PURCHASE', 'SIGNUP', 'DPA', 'OTHER'] as const;
export type LegalAcceptanceContext = (typeof ACCEPTANCE_CONTEXTS)[number];

export class CreateLegalDocumentDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  // Slice 6: authoring locale of this document's source content.
  // Omitted → 'tr' (the pre-Slice-6 behaviour for every existing row).
  @IsOptional()
  @IsIn(SUPPORTED_LOCALES)
  sourceLocale?: SupportedLocale;
}

export class CreateLegalDocumentVersionDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}

export class UpdateLegalDocumentContentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  bodyMarkdown: string;
}

// Slice 5 (2026-09-06): subjectType/subjectId/teamId removed from the
// client payload — the authenticated accept route derives all three from
// the verified JWT and the public route pins them to the visitor shape,
// so a forged body can no longer attribute an acceptance to an arbitrary
// user or team.
export class RecordLegalAcceptanceDto {
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsIn(SUPPORTED_LOCALES)
  locale: SupportedLocale;

  @IsIn(ACCEPTANCE_CONTEXTS)
  context: LegalAcceptanceContext;
}

// Public (unauthenticated) acceptance: visitor context only. No context
// choice either — everything a visitor can accept is logged as OTHER;
// SIGNUP/PURCHASE are reserved for the authenticated route.
export class RecordPublicLegalAcceptanceDto {
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsIn(SUPPORTED_LOCALES)
  locale: SupportedLocale;
}

export class ListLegalAcceptancesQueryDto {
  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsIn(ACCEPTANCE_CONTEXTS)
  context?: LegalAcceptanceContext;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  take?: string;

  @IsOptional()
  @IsString()
  skip?: string;
}
