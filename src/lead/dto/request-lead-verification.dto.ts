import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class RequestLeadVerificationDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;
}
