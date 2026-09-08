-- Signup-abuse cleanup (2026-09) -- REVERSIBLE: flags matched accounts as
-- blocked (accountBlocked = true). No rows are deleted. Run 01-diagnose.sql
-- first. To undo:  UPDATE "User" SET "accountBlocked" = false,
--                  "blockedAt" = NULL, "blockedReason" = NULL
--                  WHERE "blockedReason" = 'signup abuse: spam display name (2026-09)';

\timing on
\pset pager off

BEGIN;

-- Identical predicate to 01-diagnose.sql / 03-delete.sql.
CREATE TEMP TABLE _abuse_spam_users ON COMMIT DROP AS
WITH candidates AS (
  SELECT u.*
  FROM "User" u
  WHERE u."emailVerified" = false
    AND u.role = 'USER'
    AND u."isDeleted" = false
    AND (
         u.name ~* '(https?://|www\.|bit\.ly|t\.me|wa\.me|tinyurl|cutt\.ly|t\.co/|goo\.gl|is\.gd|linktr\.ee)'
      OR u.name ~* '[a-z0-9-]{2,}\.(com|net|org|io|co|xyz|ru|link|info|shop|store|online|site|club|top|vip|live|app|biz|pro)([/ ]|$)'
      OR u.name ~ '[0-9]{5,}'
      OR (u.name !~ '[[:alpha:]]' AND u.name ~ '[0-9$€₺£₽]')
      OR u.name ~ E'[\\x01-\\x1F]'
      OR u.name ~ '(✨|🎁|💰|🔥|🎉|👉|⭐|💵|🤑|🚀)'
    )
)
SELECT c.*
FROM candidates c
LEFT JOIN "Subscription" s
  ON s."userId" = c.id AND s.status IN ('ACTIVE', 'TRIALING', 'PAST_DUE')
WHERE s.id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Team" t
    JOIN "CustomerBots" b ON b."teamId" = t.id AND b."isDeleted" = false
    WHERE t."ownerId" = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM "Team" t
    JOIN "TeamMember" m ON m."teamId" = t.id
    WHERE t."ownerId" = c.id
      AND m.status = 'active'
      AND m."userId" IS DISTINCT FROM c.id
  );

SELECT count(*) AS about_to_block FROM _abuse_spam_users WHERE NOT "accountBlocked";

UPDATE "User" u
SET "accountBlocked" = true,
    "blockedAt"      = now(),
    "blockedReason"  = 'signup abuse: spam display name (2026-09)'
FROM _abuse_spam_users s
WHERE u.id = s.id
  AND u."accountBlocked" = false;

SELECT count(*) AS now_blocked_total
FROM "User"
WHERE "blockedReason" = 'signup abuse: spam display name (2026-09)';

COMMIT;
