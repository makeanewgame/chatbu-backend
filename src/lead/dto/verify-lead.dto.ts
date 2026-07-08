import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class VerifyLeadDto {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
