import { IsIn, IsNotEmpty, IsOptional, IsString } from "@nestjs/class-validator";

export class GenerateSystemPromptRequest {

    @IsString()
    @IsNotEmpty()
    businessName: string;

    @IsOptional()
    @IsIn(['STARTUP', 'SMALL_BUSINESS', 'MID_MARKET', 'ENTERPRISE'])
    companySize?: string;

    @IsString()
    @IsNotEmpty()
    industry: string;

    @IsOptional()
    @IsString()
    website?: string;

    @IsString()
    @IsNotEmpty()
    purpose: string;

    @IsOptional()
    pageSummaries?: { url: string; category: string; summary?: string }[];

}
