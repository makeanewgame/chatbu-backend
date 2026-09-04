import { IsEmail, IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class LostRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
