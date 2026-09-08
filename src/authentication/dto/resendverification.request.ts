import { IsEmail, IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class ResendVerificationRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;

  // Verified by TurnstileGuard; see register.request.ts.
  @IsString()
  @IsOptional()
  turnstileToken?: string;
}
