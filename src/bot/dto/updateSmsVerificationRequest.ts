import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateSmsVerificationRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsBoolean()
  smsVerificationRequired: boolean;
}
