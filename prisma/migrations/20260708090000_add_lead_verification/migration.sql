-- AlterEnum
ALTER TYPE "LogAction" ADD VALUE 'UPDATE_LEAD_VERIFICATION';

-- AlterTable
ALTER TABLE "BotLeads" ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "CustomerBots" ADD COLUMN     "leadVerificationRequired" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LeadVerification" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "LeadVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadVerification_botId_email_idx" ON "LeadVerification"("botId", "email");

-- CreateIndex
CREATE INDEX "LeadVerification_expiresAt_idx" ON "LeadVerification"("expiresAt");

