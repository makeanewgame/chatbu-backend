import { IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';

export class ResetPasswordByCodeRequest {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  confirmPassword: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
