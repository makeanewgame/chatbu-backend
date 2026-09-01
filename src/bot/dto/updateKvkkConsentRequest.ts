import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateKvkkConsentRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsBoolean()
  kvkkConsentRequired: boolean;
}
