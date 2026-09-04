import { IsNotEmpty, IsString, MinLength } from '@nestjs/class-validator';

export class PasswordRequestChange {
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  confirmPassword: string;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsString()
  lang: string;
}
