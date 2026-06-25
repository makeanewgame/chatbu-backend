import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

    @IsString()
    @IsNotEmpty()
    phoneNumberId: string;

    @IsOptional()
    @IsString()
    businessId?: string;
}
