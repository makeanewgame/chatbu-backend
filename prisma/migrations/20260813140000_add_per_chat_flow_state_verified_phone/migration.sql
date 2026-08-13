-- PerChatFlowState.verifiedPhone — cross-flow SMS-verification dedup
-- (2026-08-13). Written by BookingService/LeadService at their respective
-- OTP_VERIFIED transitions so ChatFlowService.getVerifiedPhoneForChat can
-- tell whether a phone was already SMS-verified via ANY flow (LEAD or
-- BOOKING) for this (botId, chatId) before a new OTP is sent — avoids
-- re-verifying (and re-billing NETGSM for) the same phone twice in one
-- conversation. Nullable: most rows never reach a verified phone state.

ALTER TABLE "PerChatFlowState"
  ADD COLUMN "verifiedPhone" TEXT;
