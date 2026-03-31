import { IsString, IsNotEmpty, IsArray, IsEnum, IsOptional, IsBoolean, IsInt, IsObject } from '@nestjs/class-validator';

export enum BotActionTypeDto {
    LINK = 'LINK',
    PRODUCT_CARDS = 'PRODUCT_CARDS',
    AUTH_FLOW = 'AUTH_FLOW',
    WEBHOOK = 'WEBHOOK',
}

export enum BotActionTriggerTypeDto {
    KEYWORD = 'KEYWORD',
    INTENT = 'INTENT',
}

export class CreateActionDto {
    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEnum(BotActionTypeDto)
    type: BotActionTypeDto;

    @IsOptional()
    @IsEnum(BotActionTriggerTypeDto)
    triggerType?: BotActionTriggerTypeDto;

    @IsArray()
    @IsString({ each: true })
    keywords: string[];

    @IsObject()
    config: Record<string, any>;

    @IsOptional()
    @IsInt()
    priority?: number;

    @IsOptional()
    @IsBoolean()
    isActive?: boolean;

    @IsOptional()
    @IsString()
    onError?: string;
}
