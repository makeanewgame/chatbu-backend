-- Signup-abuse cleanup (2026-09) -- DESTRUCTIVE. Deletes matched User rows.
-- FK cascades (schema.prisma: Team.ownerId, TeamMember.userId, Subscription.userId,
-- BillingInfo.userId are all onDelete: Cascade) remove the owned team, its bots,
-- chats, quotas, the team membership and the subscription with it.
--
-- PREREQUISITES:
--   * run 01-diagnose.sql and confirm section 4 is all-zero and section 3 has
--     no legitimate names
--   * ideally run 02-block.sql first and let it sit a day
--
-- Rows are copied to dated backup tables (public schema, NOT temp) before the
-- delete so the removal is auditable / partially recoverable.

\timing on
\pset pager off

BEGIN;

-- Identical predicate to 01-diagnose.sql / 02-block.sql.
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

\set backup_suffix 20260908

-- Backups (drop-and-recreate so a second run in the same day is idempotent).
DROP TABLE IF EXISTS spam_user_backup_:backup_suffix;
DROP TABLE IF EXISTS spam_team_backup_:backup_suffix;
DROP TABLE IF EXISTS spam_teammember_backup_:backup_suffix;
DROP TABLE IF EXISTS spam_subscription_backup_:backup_suffix;

CREATE TABLE spam_user_backup_:backup_suffix AS
  SELECT * FROM "User" WHERE id IN (SELECT id FROM _abuse_spam_users);

CREATE TABLE spam_team_backup_:backup_suffix AS
  SELECT * FROM "Team" WHERE "ownerId" IN (SELECT id FROM _abuse_spam_users);

CREATE TABLE spam_teammember_backup_:backup_suffix AS
  SELECT * FROM "TeamMember" WHERE "userId" IN (SELECT id FROM _abuse_spam_users)
     OR "teamId" IN (SELECT id FROM spam_team_backup_:backup_suffix);

CREATE TABLE spam_subscription_backup_:backup_suffix AS
  SELECT * FROM "Subscription" WHERE "userId" IN (SELECT id FROM _abuse_spam_users);

SELECT
  (SELECT count(*) FROM spam_user_backup_:backup_suffix)         AS backed_up_users,
  (SELECT count(*) FROM spam_team_backup_:backup_suffix)         AS backed_up_teams,
  (SELECT count(*) FROM spam_teammember_backup_:backup_suffix)   AS backed_up_memberships,
  (SELECT count(*) FROM spam_subscription_backup_:backup_suffix) AS backed_up_subscriptions;

-- The delete. Everything else goes via ON DELETE CASCADE.
WITH deleted AS (
  DELETE FROM "User"
  WHERE id IN (SELECT id FROM _abuse_spam_users)
  RETURNING id
)
SELECT count(*) AS deleted_users FROM deleted;

SELECT
  (SELECT count(*) FROM "Team"  WHERE "ownerId" IN (SELECT id FROM spam_user_backup_:backup_suffix)) AS orphan_teams_remaining,
  (SELECT count(*) FROM "User"  WHERE id        IN (SELECT id FROM spam_user_backup_:backup_suffix)) AS users_remaining;

-- Review the two counts above (both must be 0), then:
COMMIT;
-- ...or ROLLBACK; if anything looks wrong.

-- Housekeeping once you are satisfied (run manually, later):
--   DROP TABLE spam_user_backup_20260908, spam_team_backup_20260908,
--              spam_teammember_backup_20260908, spam_subscription_backup_20260908;
