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
}
