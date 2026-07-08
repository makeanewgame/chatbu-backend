import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateLeadVerificationRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsBoolean()
  leadVerificationRequired: boolean;
}
