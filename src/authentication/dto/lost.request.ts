import { IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';

export class LostRequest {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
