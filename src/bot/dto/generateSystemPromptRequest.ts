import { IsArray, IsIn, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from "@nestjs/class-validator";

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

    // v1 wizard sends a fixed enum (CUSTOMER_SUPPORT / SALES_AGENT /
    // SHOPPING_ASSISTANT). v2 wizard leaves this blank and expresses
    // intent through `capabilities` instead — see docs/WIZARD_V2.md.
    @IsOptional()
    @IsString()
    purpose?: string;

    @IsOptional()
    @IsIn(['en', 'tr', 'de', 'es', 'fr', 'it'])
    language?: string;

    @IsOptional()
    pageSummaries?: { url: string; category: string; summary?: string }[];

    // Wizard v2 structured intent inputs (forwarded to
    // /generate-system-prompt on ml-services; meta-prompt v2 renders
    // a minimal templated system prompt from these fields instead of
    // freeform-injecting business-logic directives from `purpose`).

    @IsOptional()
    @IsObject()
    capabilities?: {
        leadCapture: boolean;
        booking: boolean;
        productCatalog: boolean;
        humanEscalation: boolean;
        generalKnowledgeFallback: boolean;
    };

    @IsOptional()
    @IsObject()
    persona?: {
        name?: string;
        role?: string;
        tone?: 'warm' | 'formal' | 'casual' | 'expert';
    };

    @IsOptional()
    @IsArray()
    negatives?: string[];

    @IsOptional()
    @IsString()
    primaryLanguage?: string;

    @IsOptional()
    @IsInt()
    wizardVersion?: number;

}
