import { IsNotEmpty, IsOptional, IsString } from "@nestjs/class-validator";

export class CreateBotRequest {

    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsNotEmpty()
    botName: string;

    @IsString()
    @IsNotEmpty()
    botAvatar: string;

    @IsString()
    @IsNotEmpty()
    systemPrompt: string;

    @IsNotEmpty()
    settings: object;

    @IsOptional()
    @IsString()
    purpose?: string;

}