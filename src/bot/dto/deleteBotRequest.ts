import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class DeleteBotRequest {

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;
}