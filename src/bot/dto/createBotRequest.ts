import { IsArray, IsInt, IsNotEmpty, IsObject, IsOptional, IsString } from "@nestjs/class-validator";

export class CreateBotRequest {

    @IsString()
    @IsNotEmpty()
    user: string;

    @IsString()
    @IsNotEmpty()
    botName: string;

    @IsString()
    @IsNotEmpty()
    botAvatar: string;

    @IsString()
    @IsNotEmpty()
    systemPrompt: string;

    @IsNotEmpty()
    settings: object;

    @IsOptional()
    @IsString()
    purpose?: string;

    // Wizard v2 structured intent inputs (docs/WIZARD_V2.md).
    // Every field optional so v1 wizard (which never sends them) keeps working.

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