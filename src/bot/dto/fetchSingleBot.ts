import { IsNotEmpty, IsString, IsObject } from '@nestjs/class-validator';

export class FetchSingleBotRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;
}
