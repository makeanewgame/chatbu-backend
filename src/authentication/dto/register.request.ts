import { IsNotEmpty, IsString, IsOptional, IsBoolean } from "@nestjs/class-validator";

export class RegisterRequest {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    password: string;

    @IsString()
    @IsNotEmpty()
    phoneNumber: string;

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