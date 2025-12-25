import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAllUsersDto {
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

    @ApiProperty({ required: false, description: 'Filter by role' })
    @IsOptional()
    @IsString()
    role?: string;

    @ApiProperty({ required: false, description: 'Filter by email verified status' })
    @IsOptional()
    emailVerified?: boolean;

    @ApiProperty({ required: false, description: 'Filter by phone verified status' })
    @IsOptional()
    phoneVerified?: boolean;

    @ApiProperty({ required: false, description: 'Include deleted users' })
    @IsOptional()
    includeDeleted?: boolean;
}
