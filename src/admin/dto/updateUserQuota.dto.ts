import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsInt, Min } from 'class-validator';

export class UpdateUserQuotaDto {
    @ApiProperty({ enum: ['BOT', 'TOKEN'], description: 'Quota type to update' })
    @IsIn(['BOT', 'TOKEN'])
    quotaType: 'BOT' | 'TOKEN';

    @ApiProperty({ description: 'New limit value', minimum: 0 })
    @IsInt()
    @Min(0)
    limit: number;
}
