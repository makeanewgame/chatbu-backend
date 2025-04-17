import { IsNotEmpty, IsString } from '@nestjs/class-validator';

export class ChatRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}
