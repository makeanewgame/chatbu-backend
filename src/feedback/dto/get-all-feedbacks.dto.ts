import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { FeedbackStatus } from './update-feedback-status.dto';
import { FeedbackCategory } from './create-feedback.dto';

export class GetAllFeedbacksDto {
    @ApiPropertyOptional({
        description: 'Page number for pagination',
        example: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number;

    @ApiPropertyOptional({
        description: 'Number of items per page',
        example: 10,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number;

    @ApiPropertyOptional({
        description: 'Filter by feedback status',
        enum: FeedbackStatus,
    })
    @IsOptional()
    @IsEnum(FeedbackStatus)
    status?: FeedbackStatus;

    @ApiPropertyOptional({
        description: 'Filter by feedback category',
        enum: FeedbackCategory,
    })
    @IsOptional()
    @IsEnum(FeedbackCategory)
    category?: FeedbackCategory;

    @ApiPropertyOptional({
        description: 'Search in user name, email, or message',
        example: 'bug',
    })
    @IsOptional()
    @IsString()
    search?: string;
}
