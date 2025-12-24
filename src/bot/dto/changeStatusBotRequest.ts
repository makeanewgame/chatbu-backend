import { IsBoolean, IsNotEmpty, IsString } from "@nestjs/class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class ChageStatusBotRequest {

    @ApiProperty({
        description: 'User ID uuid',
        example: '123e4567-e89b-12d3-a456-426614174000',
        type: String,
        required: true,
        nullable: false,
        default: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsNotEmpty()
    teamId: string;

    @ApiProperty({
        description: 'Bot ID uuid',
        example: '123e4567-e89b-12d3-a456-426614174000',
        type: String,
        required: true,
        nullable: false,
        default: '123e4567-e89b-12d3-a456-426614174000',
    })
    @IsString()
    @IsNotEmpty()
    botId: string;

    @ApiProperty({
        description: 'Status of the bot enabled or disabled',
        example: true,
        type: Boolean,
        required: true,
        nullable: false,
        default: true,
    })
    @IsBoolean()
    @IsNotEmpty()
    active: boolean;
}


export class ChageStatusBotResponse {

    @ApiProperty({
        description: 'Status of the bot enabled or disabled',
        example: "Bot status changed",
        type: String,
        required: true,
        nullable: false,
        default: true,
    })
    @IsString()
    message: string;
}