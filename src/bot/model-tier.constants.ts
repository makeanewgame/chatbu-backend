export const MODEL_TIERS = ['haiku', 'sonnet'] as const;
export type ModelTier = typeof MODEL_TIERS[number];
export const DEFAULT_MODEL_TIER: ModelTier = 'haiku';
