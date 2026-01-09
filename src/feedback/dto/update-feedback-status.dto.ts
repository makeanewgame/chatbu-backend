import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export enum FeedbackStatus {
    PENDING = 'PENDING',
    IN_REVIEW = 'IN_REVIEW',
    RESOLVED = 'RESOLVED',
}

export class UpdateFeedbackStatusDto {
    @ApiProperty({
        description: 'Feedback status',
        enum: FeedbackStatus,
        example: FeedbackStatus.IN_REVIEW,
    })
    @IsEnum(FeedbackStatus)
    @IsNotEmpty()
    status: FeedbackStatus;
}
