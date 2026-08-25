import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from "@nestjs/class-validator";

export class RenameBotRequest {

    @IsString()
    @IsNotEmpty()
    teamId: string;

    @IsString()
    @IsNotEmpty()
    botId: string;

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsNotEmpty()
    systemPrompt: string;

    // Wizard v2 structured intent inputs (docs/WIZARD_V2.md).
    // When the FE regenerate-prompt modal runs the wizard v2 flow
    // (existing-bot regeneration), these fields carry the same
    // capabilities/persona/negatives/primaryLanguage inputs the
    // create-flow wizard collects — persisted alongside the
    // freshly-synthesized system prompt so a later regeneration
    // pre-fills correctly and downstream consumers (lead email
    // locale, platform capability gates) can read them.
    // Absent → existing values on the bot are left unchanged.

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