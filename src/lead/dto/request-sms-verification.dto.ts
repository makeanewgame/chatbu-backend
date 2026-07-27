import { IsNotEmpty, IsString } from 'class-validator';

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
}
