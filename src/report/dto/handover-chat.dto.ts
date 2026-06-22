import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class HandoverChatDto {
    @ApiProperty({ description: 'The User.id of the agent to assign the chat to' })
    @IsString()
    @IsNotEmpty()
    agentUserId: string;
}
