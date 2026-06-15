-- Migration: Switch FILE quota from count-based to KB-based storage quota
-- Free users: 10 MB = 10240 KB
-- Premium users: 250 MB = 256000 KB

-- Reset all existing FILE quotas: limit = FREE default, used = 0
-- Subscription-aware limits are applied by updateStorageQuotaLimits() on first request.
UPDATE "Quota"
SET "limit" = 10240,
    "used"  = 0
WHERE "quotaType" = 'FILE';

-- Add SystemSettings entries for storage limits (skip if already exists)
INSERT INTO "SystemSettings" ("id", "key", "value", "description", "createdAt", "updatedAt")
VALUES
  (left(md5(random()::text), 25), 'FREE_STORAGE_LIMIT_KB',    '10240',  'Free tier vector DB storage quota in KB (10 MB)',    NOW(), NOW()),
  (left(md5(random()::text), 25), 'PREMIUM_STORAGE_LIMIT_KB', '256000', 'Premium tier vector DB storage quota in KB (250 MB)', NOW(), NOW())
ON CONFLICT ("key") DO NOTHING;
