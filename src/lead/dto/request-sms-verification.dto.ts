import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class RequestSmsVerificationDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  phone: string;

  /**
   * Conversation-language hint from the agent (2-letter, e.g. 'tr').
   * Wins over the phone-country fallback for the OTP template language
   * (see resolveOtpLang) — a +49 diaspora visitor chatting in Turkish
   * gets a Turkish SMS. Optional; sanitized server-side.
   */
  @IsString()
  @IsOptional()
  @MaxLength(8)
  lang?: string;
}
