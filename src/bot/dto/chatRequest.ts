import { IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';

export interface ChatAttachment {
  storageId: string;
  objectPath: string;
  fileName: string;
  fileType: string;
  size: number;
}

export class ChatRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  attachments?: ChatAttachment[];

  @IsOptional()
  @IsString()
  externalContactName?: string;

  // Widget's active i18next locale (from LanguageDetector: querystring →
  // cookie → localStorage → navigator). Piped through to the gateway
  // as `visitor_locale` so the deterministic response-language resolver
  // has a tie-breaker when the visitor's own message is too short for
  // reliable detection (single digit, "??", emoji-only). Optional and
  // additive — older widgets that don't send it just fall back to
  // language detection on the message text.
  @IsOptional()
  @IsString()
  visitorLocale?: string;

  // Browser Accept-Language HTTP header, captured at the widget/chat
  // controller from `req.headers['accept-language']` and forwarded to
  // the gateway. Third-tier signal for the gateway's v2 hybrid
  // language resolver — used when session sticky is empty AND lingua
  // is unreliable AND visitor_locale is absent. Optional; the widget
  // controller populates it, the direct /bot/chat path may not.
  @IsOptional()
  @IsString()
  acceptLanguage?: string;
}
