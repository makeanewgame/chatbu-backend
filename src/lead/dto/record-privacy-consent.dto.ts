import { IsNotEmpty, IsString } from 'class-validator';

export class RecordPrivacyConsentDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;
}
