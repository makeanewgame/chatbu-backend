import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export enum FeedbackCategory {
    BUG_REPORT = 'BUG_REPORT',
    FEATURE_REQUEST = 'FEATURE_REQUEST',
    GENERAL_FEEDBACK = 'GENERAL_FEEDBACK',
}

export class CreateFeedbackDto {
    @ApiProperty({
        description: 'Feedback category',
        enum: FeedbackCategory,
        example: FeedbackCategory.GENERAL_FEEDBACK,
    })
    @IsEnum(FeedbackCategory)
    @IsNotEmpty()
    category: FeedbackCategory;

    @ApiProperty({
        description: 'Feedback message',
        example: 'The chat interface is very intuitive and easy to use.',
        maxLength: 1000,
    })
    @IsString()
    @IsNotEmpty()
    @MaxLength(1000, { message: 'Message cannot be longer than 1000 characters' })
    message: string;
}
