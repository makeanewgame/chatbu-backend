-- Slice 2 (2026-08-13): add ISO alpha-2 destination country to the
-- lead SMS verification row so the new SmsService router (which parses
-- phone via libphonenumber-js and picks NETGSM vs Twilio by country)
-- can persist WHERE each OTP went. Feeds:
--   - the `chatbu_sms_send_total{country}` prometheus counter
--   - future per-country cost slicing + daily-cap circuit breaker
--   - the country → language lookup for the OTP body
--     (TR → 'tr', else → 'en')
--
-- Nullable + no default so:
--   - pre-Slice-2 rows keep working without a backfill
--   - the ALTER TABLE is O(1) (Postgres just updates the catalog,
--     no row rewrite)
-- Ingest / OTP flow always writes country going forward.

ALTER TABLE "LeadSmsVerification" ADD COLUMN "country" TEXT;
