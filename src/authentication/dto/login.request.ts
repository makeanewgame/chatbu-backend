import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class LoginRequest {

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

}