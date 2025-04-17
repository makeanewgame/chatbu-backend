import { IsNotEmpty, IsString, IsObject } from '@nestjs/class-validator';

export class UpdateSettingsRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsObject()
  @IsNotEmpty()
  settings: Record<string, any>;
}
