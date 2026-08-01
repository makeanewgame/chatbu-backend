-- CreateEnum
CREATE TYPE "FlowKind" AS ENUM ('LEAD', 'BOOKING', 'HANDOFF', 'FEEDBACK');

-- CreateTable
CREATE TABLE "PerChatFlowState" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "flowKind" "FlowKind" NOT NULL,
    "state" TEXT NOT NULL,
    "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "payload" JSONB,

    CONSTRAINT "PerChatFlowState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PerChatFlowState_botId_chatId_flowKind_key" ON "PerChatFlowState"("botId", "chatId", "flowKind");

-- CreateIndex
CREATE INDEX "PerChatFlowState_botId_state_updatedAt_idx" ON "PerChatFlowState"("botId", "state", "updatedAt");

-- CreateIndex
CREATE INDEX "PerChatFlowState_chatId_idx" ON "PerChatFlowState"("chatId");
