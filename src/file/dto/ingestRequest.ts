
import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class IngestRequest {

    @IsString()
    @IsNotEmpty()
    userId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsString()
    @IsNotEmpty()
    type: string;

}