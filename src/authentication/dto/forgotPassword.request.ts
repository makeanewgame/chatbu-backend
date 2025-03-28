import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class RegisterRequest {
  @IsString()
  @IsNotEmpty()
  email: string;

  updated_at: string;
  created_at: string;
  refreshtoken: string;
  emailVerified: boolean;
}
