-- CustomerChats.detectedLanguage — conversation language detected from
-- the visitor's first message, locked for the life of the chat (2026-08-11).
--
-- Nullable, no default: existing chats stay NULL (gateway falls back to
-- its pre-existing per-turn heuristic for those). New chats get it set
-- once at creation time from the gateway's first-turn language detection,
-- and the gateway's LanguageEnforcementMiddleware reuses that value on
-- every subsequent turn instead of re-detecting from the full transcript
-- each time — avoiding drift when later messages are structured input
-- (phone numbers, OTP codes) that confuse the per-turn heuristic.

ALTER TABLE "CustomerChats"
  ADD COLUMN "detectedLanguage" TEXT;
