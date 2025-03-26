import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class PasswordRequestChange {

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    code: string;

    @IsString()
    @IsNotEmpty()
    userId: string;

}