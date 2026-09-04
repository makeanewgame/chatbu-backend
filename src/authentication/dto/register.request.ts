import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEmail, MaxLength, MinLength } from "@nestjs/class-validator";
import { NormalizeEmail } from "src/util/normalize-email.util";

export class RegisterRequest {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    name: string;

    @IsEmail()
    @IsNotEmpty()
    @NormalizeEmail()
    email: string;

    @IsString()
    @IsNotEmpty()
    @MinLength(8)
    password: string;

    @IsString()
    @IsOptional()
    phoneNumber?: string;

    @IsBoolean()
    @IsNotEmpty()
    termsAccepted: boolean;

    @IsString()
    @IsOptional()
    invitationToken?: string;

    @IsString()
    @IsOptional()
    teamId?: string;

    updated_at: string;
    created_at: string;
    refreshtoken: string;
    emailVerified: boolean;
    phoneVerified: boolean;

}
