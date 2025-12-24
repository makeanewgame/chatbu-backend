import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class DeleteBotRequest {

    @IsString()
    @IsNotEmpty()
    teamId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;
}