import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class UpdateStreamingEnabledRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsBoolean()
  streamingEnabled: boolean;
}
