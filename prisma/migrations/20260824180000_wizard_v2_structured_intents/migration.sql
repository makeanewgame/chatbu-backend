-- Wizard v2: structured owner-intent inputs on CustomerBots.
-- All columns additive + nullable / defaulted so v1 bots stay
-- untouched. wizardVersion=1 means "legacy unstructured prompt";
-- wizardVersion=2 (set by the wizard v2 FE flow) means "structured
-- intents drove the meta-prompt v2 synthesis — the gateway can
-- trust that the systemPrompt does not contain competing
-- lead-capture / booking / catalog directives".
-- Spec: chatbu-backend/docs/WIZARD_V2.md

ALTER TABLE "CustomerBots"
  ADD COLUMN "capabilities"     JSONB,
  ADD COLUMN "persona"          JSONB,
  ADD COLUMN "negatives"        TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN "primaryLanguage"  TEXT,
  ADD COLUMN "wizardVersion"    INTEGER NOT NULL DEFAULT 1;
