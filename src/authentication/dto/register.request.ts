import { IsNotEmpty, IsString, IsOptional, IsBoolean, IsEmail, MaxLength, MinLength } from "@nestjs/class-validator";
import { NormalizeEmail } from "src/util/normalize-email.util";
import { IsHumanName } from "../utils/suspicious-name.util";
import { IsNotDisposableEmail } from "../utils/disposable-email-domains";

export class RegisterRequest {
    @IsString()
    @IsNotEmpty()
    @MaxLength(120)
    @IsHumanName()
    name: string;

    @IsEmail()
    @IsNotEmpty()
    @NormalizeEmail()
    @IsNotDisposableEmail()
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

    // Cloudflare Turnstile token; verified by TurnstileGuard before this DTO
    // is even constructed. Optional here so the guard owns the "missing token"
    // response and the field survives the whitelist validation pipe.
    @IsString()
    @IsOptional()
    turnstileToken?: string;

    updated_at: string;
    created_at: string;
    refreshtoken: string;
    emailVerified: boolean;
    phoneVerified: boolean;

}
