import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAllTeamsDto {
    @ApiProperty({ required: false, description: 'Page number' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    page?: number;

    @ApiProperty({ required: false, description: 'Page size' })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    limit?: number;

    @ApiProperty({ required: false, description: 'Search term' })
    @IsOptional()
    @IsString()
    search?: string;
}
