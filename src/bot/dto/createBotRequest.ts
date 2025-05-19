import { IsNotEmpty, IsString } from "@nestjs/class-validator";

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

}