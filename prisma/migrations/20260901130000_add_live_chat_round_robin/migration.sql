-- Live-chat handoff round-robin (plan file
-- `.claude/plans/cozy-soaring-bentley.md`).
--
-- Replaces the single per-bot `CustomerBots.settings.defaultAgentId` with a
-- team-wide roster: each active member can be flagged for live chat and
-- incoming handoffs rotate fairly across the flagged members.
--
--   TeamMember.canLiveChat        — member takes part in the rotation
--   Team.defaultLiveChatAgentId   — fallback assignee when nobody is flagged,
--                                   and the manual-handover modal default
--   Team.lastLiveChatAgentId      — round-robin cursor (last auto-assigned userId)
--
-- All additive. canLiveChat is NOT NULL DEFAULT false; the two Team columns are
-- nullable. Existing behaviour is preserved by the one-shot backfill script
-- `scripts/backfill-live-chat-roster.ts` (sets the owner canLiveChat=true and
-- Team.defaultLiveChatAgentId), run once per env after this migration applies.

-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN "canLiveChat" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Team" ADD COLUMN "defaultLiveChatAgentId" TEXT;
ALTER TABLE "Team" ADD COLUMN "lastLiveChatAgentId" TEXT;
