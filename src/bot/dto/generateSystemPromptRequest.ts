import { IsIn, IsNotEmpty, IsOptional, IsString } from "@nestjs/class-validator";

export class GenerateSystemPromptRequest {

    // Required so the generated draft can be billed against the team's token
    // quota — see BotService.generateSystemPrompt / trackTokenUsage.
    @IsString()
    @IsNotEmpty()
    teamId: string;

    @IsOptional()
    @IsString()
    botId?: string;

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
    @IsIn(['en', 'tr'])
    language?: string;

    @IsOptional()
    pageSummaries?: { url: string; category: string; summary?: string }[];

}
