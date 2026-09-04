-- Unified "Sohbetler" inbox: agent-facing unread counter on a conversation.
-- Only ever > 0 while the chat is with a human (chatStatus HUMAN_REQUESTED /
-- HUMAN_ASSIGNED / HUMAN_ACTIVE); bot-handled chats never accrue unread.
-- Incremented on each visitor message at the persist sites, reset to 0 by
-- POST /report/conversations/:chatId/read and whenever the assigned agent
-- sends a message or closes the chat. No backfill — existing rows start at 0.

-- AlterTable
ALTER TABLE "CustomerChats" ADD COLUMN "agentUnreadCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CustomerChats" ADD COLUMN "agentLastReadAt" TIMESTAMP(3);
