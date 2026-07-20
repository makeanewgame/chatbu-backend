import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CompleteMetaConnectionDto {
    @IsString()
    @IsNotEmpty()
    chatbotId: string;

    @IsString()
    @IsNotEmpty()
    pageId: string;

    @IsString()
    @IsNotEmpty()
    pageName: string;

    @IsString()
    @IsNotEmpty()
    pageAccessToken: string;

    @IsBoolean()
    enableMessenger: boolean;

    @IsBoolean()
    enableInstagram: boolean;

    @IsOptional()
    @IsString()
    instagramAccountId?: string;

    @IsOptional()
    @IsString()
    instagramUsername?: string;

    @IsOptional()
    @IsString()
    fbUserId?: string;
}
