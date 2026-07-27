-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'UPDATE_SMS_VERIFICATION';

-- AlterTable
ALTER TABLE "BotLeads" ADD COLUMN     "smsVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "privacyConsentId" TEXT;

-- AlterTable
ALTER TABLE "CustomerBots" ADD COLUMN     "smsVerificationRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LeadSmsVerification" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "LeadSmsVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeadPrivacyConsent" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "phone" TEXT,
    "source" TEXT NOT NULL DEFAULT 'chatbot',
    "privacyVersion" TEXT NOT NULL,
    "privacyAcceptedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpVerifiedAt" TIMESTAMP(3),
    "leadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadPrivacyConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadSmsVerification_botId_phone_idx" ON "LeadSmsVerification"("botId", "phone");

-- CreateIndex
CREATE INDEX "LeadSmsVerification_expiresAt_idx" ON "LeadSmsVerification"("expiresAt");

-- CreateIndex
CREATE INDEX "LeadPrivacyConsent_botId_chatId_idx" ON "LeadPrivacyConsent"("botId", "chatId");

-- CreateIndex
CREATE INDEX "LeadPrivacyConsent_leadId_idx" ON "LeadPrivacyConsent"("leadId");
