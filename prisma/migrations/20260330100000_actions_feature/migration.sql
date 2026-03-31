-- CreateEnum
CREATE TYPE "BotActionType" AS ENUM ('LINK', 'PRODUCT_CARDS', 'AUTH_FLOW', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "BotActionTriggerType" AS ENUM ('KEYWORD', 'INTENT');

-- CreateTable
CREATE TABLE "BotAction" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BotActionType" NOT NULL,
    "triggerType" "BotActionTriggerType" NOT NULL DEFAULT 'KEYWORD',
    "keywords" TEXT[],
    "config" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "onError" TEXT NOT NULL DEFAULT 'fallback',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAuthSession" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotAction_botId_idx" ON "BotAction"("botId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAuthSession_token_key" ON "ChatAuthSession"("token");

-- CreateIndex
CREATE INDEX "ChatAuthSession_chatId_botId_idx" ON "ChatAuthSession"("chatId", "botId");

-- AddForeignKey
ALTER TABLE "BotAction" ADD CONSTRAINT "BotAction_botId_fkey"
    FOREIGN KEY ("botId") REFERENCES "CustomerBots"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
