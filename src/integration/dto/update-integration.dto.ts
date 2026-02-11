import { IsNotEmpty, IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateIntegrationDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsObject()
    config?: Record<string, any>;
}
