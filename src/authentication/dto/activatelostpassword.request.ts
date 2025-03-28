import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class ActivateLostPasswordRequest {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  code: string;
}
