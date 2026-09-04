import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class ResetPasswordByCodeRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  confirmPassword: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
