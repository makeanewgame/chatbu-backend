import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class RenameBotRequest {

    @IsString()
    @IsNotEmpty()
    teamId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    systemPrompt: string;
}