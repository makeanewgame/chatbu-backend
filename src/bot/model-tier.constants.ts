export const MODEL_TIERS = ['haiku', 'sonnet'] as const;
export type ModelTier = typeof MODEL_TIERS[number];
// Sonnet became the default for new bots on 2026-09-11, and stopped being a
// Premium-only tier at the same time. Haiku stays selectable.
export const DEFAULT_MODEL_TIER: ModelTier = 'sonnet';
