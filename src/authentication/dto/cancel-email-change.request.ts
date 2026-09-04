import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class CancelEmailChangeRequest {
  @IsString()
  @IsNotEmpty()
  token: string;
}
