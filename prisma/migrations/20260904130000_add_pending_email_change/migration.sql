-- Verified two-step account email change.
--
-- The new address a user requests is parked in `pendingEmail` (plus a 6-digit
-- `pendingEmailCode` and its `pendingEmailExpiresAt`) and only promoted to
-- `email` once the code delivered to that address is confirmed. This keeps a
-- typo'd address from locking the account out and stops a hijacked session
-- from silently taking the account over.
--
-- `pendingEmailCancelToken` is a random opaque token embedded in the
-- "you didn't request this?" notice sent to the *current* address, so the
-- rightful owner can abort a change without logging in.
--
-- All nullable, no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "pendingEmail" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingEmailCode" TEXT;
ALTER TABLE "User" ADD COLUMN "pendingEmailExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "pendingEmailCancelToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_pendingEmailCancelToken_key" ON "User"("pendingEmailCancelToken");
