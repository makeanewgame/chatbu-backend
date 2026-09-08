-- Signup-abuse cleanup (2026-09) -- DIAGNOSIS ONLY, no writes.
-- Run this first and eyeball every section before running 02 / 03.
-- See scripts/abuse-cleanup/README.md for the detection rationale.
--
-- The _abuse_spam_users temp table below is defined IDENTICALLY in 02 and 03.
-- If you tune the predicate, change it in all three files.

\timing on
\pset pager off

BEGIN;

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

-- 1. Total blast radius -----------------------------------------------------
SELECT
  (SELECT count(*) FROM "User")                                                AS total_users,
  (SELECT count(*) FROM _abuse_spam_users)                                     AS spam_users_matched,
  (SELECT count(*) FROM "User" WHERE "emailVerified" = false AND role = 'USER') AS all_unverified_users;

-- 2. Matches per day (spot the attack window) -----------------------------
SELECT date_trunc('day', "createdAt")::date AS day, count(*)
FROM _abuse_spam_users
GROUP BY 1 ORDER BY 1;

-- 3. Sample of matched names (REVIEW for false positives) ----------------
SELECT id, left(name, 80) AS name, email, "createdAt"
FROM _abuse_spam_users
ORDER BY "createdAt" DESC
LIMIT 60;

-- 4. Safety cross-checks: every column here should be 0 -----------------
SELECT
  count(*) FILTER (WHERE "emailVerified")                                 AS matched_but_verified,
  count(*) FILTER (WHERE "phoneVerified")                                 AS matched_but_phone_verified,
  count(*) FILTER (WHERE "googleId" IS NOT NULL OR "appleId" IS NOT NULL) AS matched_but_oauth
FROM _abuse_spam_users;

-- 5. Cascade preview: what 03-delete.sql would remove ------------------
SELECT
  (SELECT count(*) FROM _abuse_spam_users)                                                       AS users,
  (SELECT count(*) FROM "Team" t         WHERE t."ownerId" IN (SELECT id FROM _abuse_spam_users)) AS owned_teams,
  (SELECT count(*) FROM "TeamMember" m   WHERE m."userId"  IN (SELECT id FROM _abuse_spam_users)) AS team_memberships,
  (SELECT count(*) FROM "Subscription" s WHERE s."userId"  IN (SELECT id FROM _abuse_spam_users)) AS subscriptions;

-- 6. Near-misses: unverified USER accounts NOT matched, sanity look -----
SELECT id, left(name, 80) AS name, email, "createdAt"
FROM "User" u
WHERE u."emailVerified" = false AND u.role = 'USER' AND u."isDeleted" = false
  AND u.id NOT IN (SELECT id FROM _abuse_spam_users)
ORDER BY "createdAt" DESC
LIMIT 30;

ROLLBACK;
