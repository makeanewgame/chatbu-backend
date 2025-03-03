import { IsNotEmpty, IsString } from "@nestjs/class-validator";

export class ActivateRegistrationRequest {

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    code: string;

}