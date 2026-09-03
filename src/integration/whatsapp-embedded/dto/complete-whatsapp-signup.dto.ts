import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteWhatsAppSignupDto {
    @IsString()
    @IsNotEmpty()
    chatbotId: string;

    @IsString()
    @IsNotEmpty()
    authorizationCode: string;

    @IsString()
    @IsNotEmpty()
    wabaId: string;

    // Optional: absent for coexistence onboarding (FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING
    // only returns waba_id). Resolved server-side from the WABA when missing.
    @IsOptional()
    @IsString()
    @IsNotEmpty()
    phoneNumberId?: string;

    @IsOptional()
    @IsString()
    businessId?: string;

    // True when the customer connected an existing WhatsApp Business app number
    // (coexistence). The number is already registered, so the /register step is skipped.
    @IsOptional()
    @IsBoolean()
    coexistence?: boolean;
}
