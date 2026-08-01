import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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
}
