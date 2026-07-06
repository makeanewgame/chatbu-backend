import { IsIn, IsString } from 'class-validator';
import { MODEL_TIERS, ModelTier } from '../model-tier.constants';

export class UpdateModelTierRequest {
    @IsString()
    botId: string;

    @IsIn(MODEL_TIERS as unknown as string[], { message: 'Invalid model tier' })
    modelTier: ModelTier;
}
