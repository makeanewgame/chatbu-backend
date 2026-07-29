import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export const SUPPORTED_LOCALES = ['tr', 'en', 'de', 'fr', 'it', 'ru', 'ar', 'es'] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

// Turkish is always authored first; every other locale is a translation of it.
export const SOURCE_LOCALE: SupportedLocale = 'tr';

export const ACCEPTANCE_CONTEXTS = ['PURCHASE', 'SIGNUP', 'OTHER'] as const;
export type LegalAcceptanceContext = (typeof ACCEPTANCE_CONTEXTS)[number];

export class CreateLegalDocumentDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  name: string;
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

export class RecordLegalAcceptanceDto {
  @IsString()
  @IsNotEmpty()
  versionId: string;

  @IsIn(SUPPORTED_LOCALES)
  locale: SupportedLocale;

  @IsIn(ACCEPTANCE_CONTEXTS)
  context: LegalAcceptanceContext;

  @IsString()
  @IsNotEmpty()
  subjectType: string;

  @IsOptional()
  @IsString()
  subjectId?: string;

  @IsOptional()
  @IsString()
  teamId?: string;
}
