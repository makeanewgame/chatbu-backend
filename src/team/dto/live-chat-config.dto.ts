import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class LiveChatAgentFlagDto {
    @IsString()
    userId: string;

    @IsBoolean()
    canLiveChat: boolean;
}

export class UpdateLiveChatConfigDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => LiveChatAgentFlagDto)
    agents: LiveChatAgentFlagDto[];

    // null clears the fallback agent (rotation-only). Omitted → unchanged.
    @IsOptional()
    @IsString()
    defaultAgentId?: string | null;
}
