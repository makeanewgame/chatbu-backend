import { IsEmail, IsNotEmpty, IsString } from '@nestjs/class-validator';
import { NormalizeEmail } from 'src/util/normalize-email.util';

export class ActivateLostPasswordRequest {
  @IsEmail()
  @IsNotEmpty()
  @NormalizeEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
