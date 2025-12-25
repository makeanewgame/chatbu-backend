import { IsNotEmpty, IsString, IsOptional } from "@nestjs/class-validator";

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