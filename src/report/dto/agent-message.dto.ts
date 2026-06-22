import { ApiProperty } from '@nestjs/swagger';

export class AgentMessageDto {
    @ApiProperty({ description: 'The message text to send to the customer' })
    message: string;
}
