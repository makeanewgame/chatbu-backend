import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class CreateIntegrationDto {
    @IsString()
    @IsNotEmpty()
    type: string;

    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsOptional()
    @IsObject()
    config?: Record<string, any>;
}
