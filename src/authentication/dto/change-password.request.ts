import { IsOptional, IsString, MinLength } from '@nestjs/class-validator';

export class ChangePasswordRequest {
  // Optional: absent when an OAuth-only account is setting its first password.
  @IsString()
  @IsOptional()
  oldPassword?: string;

  @IsString()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @MinLength(8)
  confirmPassword: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
