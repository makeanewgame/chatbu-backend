import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class ResendVerificationRequest {
  @IsString()
  @IsNotEmpty()
  email: string;
}
