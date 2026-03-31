import { IsString, IsNotEmpty, IsArray, IsOptional, IsBoolean, IsInt, IsObject } from '@nestjs/class-validator';

export class UpdateActionDto {
    @IsString()
    @IsNotEmpty()
    id: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    keywords?: string[];

    @IsOptional()
    @IsObject()
    config?: Record<string, any>;

    @IsOptional()
    @IsInt()
    priority?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    onError?: string;
}
