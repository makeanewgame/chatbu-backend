import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class LostRequest {
  @IsString()
  @IsNotEmpty()
  email: string;
}
