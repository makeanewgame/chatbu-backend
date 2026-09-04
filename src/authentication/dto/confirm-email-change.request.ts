import { IsNotEmpty, IsOptional, IsString, Length } from '@nestjs/class-validator';

export class ConfirmEmailChangeRequest {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  code: string;

  @IsString()
  @IsOptional()
  lang?: string;
}
