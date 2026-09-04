import { IsEmail, IsNotEmpty } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class ResendVerificationRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;
}
