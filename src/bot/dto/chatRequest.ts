import { IsIn, IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';

export const CHAT_SOURCE_CHANNELS = [
  'widget',
  'messenger',
  'instagram',
  'whatsapp_embed',
  'whatsapp',
  'wa_test',
] as const;

export type ChatSourceChannel = typeof CHAT_SOURCE_CHANNELS[number];

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

  // Which surface originated this chat turn. Populated by the caller
  // that hands the message to the bot pipeline: 'widget' for the site
  // chat widget (default when unset), 'messenger' / 'instagram' /
  // 'whatsapp_embed' / 'whatsapp' / 'wa_test' for the Meta-adjacent
  // webhook handlers in src/meta, src/meta-whatsapp, src/whatsapp.
  //
  // Forwarded to the gateway as `source_channel` so the agent knows
  // whether widget-rendered primitives (KVKK consent card, contact
  // form, SMS OTP input, appointment slot picker) are actually
  // renderable. Older gateway pods that predate the field ignore it
  // (Pydantic Optional pattern). Additive and backward-compat: absent
  // = widget = today's behaviour.
  //
  // See fovi-longa-chat-be .claude/plans/channel-aware-chat-architecture.md
  // (backlog #23) for the end-to-end design.
  @IsOptional()
  @IsString()
  @IsIn(CHAT_SOURCE_CHANNELS as unknown as string[])
  sourceChannel?: ChatSourceChannel;
}
