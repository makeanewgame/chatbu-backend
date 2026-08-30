import { Type } from 'class-transformer';
import { IsEmail, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

export class LeadDataDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  source_bot?: string;
}

export class SubmitLeadDto {
  @IsString()
  botId: string;

  @IsOptional()
  @IsString()
  chatId?: string | null;

  @IsObject()
  @ValidateNested()
  @Type(() => LeadDataDto)
  leadData: LeadDataDto;

  @IsOptional()
  @IsString()
  verificationToken?: string | null;

  @IsOptional()
  @IsString()
  smsVerificationToken?: string | null;

  // Originating chat surface — 'widget' (default when omitted) or one
  // of the Meta-adjacent channels: 'messenger' | 'instagram' |
  // 'whatsapp_embed' | 'whatsapp' | 'wa_test'. Forwarded by the
  // MCP capture_lead tool. On Meta channels the platform already
  // authenticates the visitor (their IG / FB / WA account IS the
  // identity), so email + SMS OTP verification gates are bypassed
  // and consent is recorded inline from the conversation confirmation
  // the agent obtained. See fovi-longa-chat-be
  // .claude/plans/channel-aware-chat-architecture.md Slice 2.
  @IsOptional()
  @IsString()
  sourceChannel?: string | null;
}
