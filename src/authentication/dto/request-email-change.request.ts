import { IsEmail, IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class RequestEmailChangeRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  newEmail: string;

  // Required for password accounts; OAuth-only accounts are rejected earlier
  // with a NO_PASSWORD response regardless of what is sent here.
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
