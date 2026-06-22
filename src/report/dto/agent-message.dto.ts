import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AgentMessageDto {
    @ApiProperty({ description: 'The message text to send to the customer' })
    @IsString()
    @IsNotEmpty()
    message: string;
}
