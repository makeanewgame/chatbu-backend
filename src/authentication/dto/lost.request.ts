import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class LostRequest {
  @IsString()
  @IsNotEmpty()
  email: string;
  @IsString()
  @IsNotEmpty()
  code: string;
  updated_at: string;
  created_at: string;
  refreshtoken: string;
  emailVerified: boolean;
}
