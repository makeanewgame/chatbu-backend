import { IsEmail, IsNotEmpty } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class ForgotPasswordRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;

  updated_at: string;
  created_at: string;
  refreshtoken: string;
  emailVerified: boolean;
}
