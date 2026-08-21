import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { JURISDICTIONS, Jurisdiction } from '../jurisdiction.util';

export class RecordPrivacyConsentDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  // Optional so the widget can record consent BEFORE the first chat POST
  // has allocated a session_id. Backend binds this consent to a real
  // chatId on the next chat POST via `provisionalConsentId`. See
  // chicken-and-egg fix, 2026-08-01.
  @IsString()
  @IsOptional()
  chatId?: string;

  // Slice 3 (2026-08-20): optional locale + jurisdiction the widget
  // rendered the consent card in. When present these override the
  // backend's server-side resolution (which uses Accept-Language +
  // bot default). The widget SHOULD send them so the persisted row
  // reflects exactly what the visitor saw, not what the backend
  // would have resolved from headers alone.
  @IsString()
  @IsOptional()
  locale?: string;

  @IsOptional()
  @IsIn(JURISDICTIONS as readonly string[])
  jurisdiction?: Jurisdiction;
}
