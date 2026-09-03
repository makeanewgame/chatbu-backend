-- Slice A (voice-message plan 2026-09-01): add per-team monthly voice
-- transcription usage counter. Amazon Transcribe eu-central-1 bills
-- ~$0.024/min so we track minutes to feed a monthly cap + owner-visible
-- usage panel (aligned with the existing storage/message quota shape).
--
-- Nullable + default 0 so:
--   - existing quota rows continue working without a backfill
--   - the ALTER TABLE stays O(1) (catalog-only, no row rewrite)
--
-- Increment happens ONCE per successful transcription inside
-- AudioTranscriptionService.transcribe, on the same row keyed by
-- (teamId, quotaType). Kanal handlers and the widget endpoint DO NOT
-- also increment — the double-count file-ingest bug (2026-08-14) is the
-- reason single-writer is a hard rule here.

ALTER TABLE "Quota" ADD COLUMN "voiceMessageMinutesUsed" INTEGER DEFAULT 0;
