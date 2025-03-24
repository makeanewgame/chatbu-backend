import { IsBoolean, IsNotEmpty, IsString } from "@nestjs/class-validator";

export class ChageStatusBotRequest {

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsBoolean()
    @IsNotEmpty()
    active: boolean;
}