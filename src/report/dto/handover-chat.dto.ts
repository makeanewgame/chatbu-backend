import { ApiProperty } from '@nestjs/swagger';

export class HandoverChatDto {
    @ApiProperty({ description: 'The User.id of the agent to assign the chat to' })
    agentUserId: string;
}
