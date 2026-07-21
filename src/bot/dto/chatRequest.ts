import { IsNotEmpty, IsOptional, IsString } from '@nestjs/class-validator';

export interface ChatAttachment {
  storageId: string;
  objectPath: string;
  fileName: string;
  fileType: string;
  size: number;
}

export class ChatRequest {
  @IsString()
  @IsNotEmpty()
  botId: string;

  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsNotEmpty()
  chatId: string;

  @IsString()
  @IsNotEmpty()
  teamId: string;

  @IsString()
  @IsNotEmpty()
  sender: string;

  @IsString()
  @IsNotEmpty()
  date: string;

  @IsOptional()
  attachments?: ChatAttachment[];

  @IsOptional()
  @IsString()
  externalContactName?: string;
}
