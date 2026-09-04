-- Sign in with Apple: store Apple's stable subject id so an Apple account is
-- matched on that durable key rather than on its (rotatable, private-relay)
-- email. Mirrors the existing googleId column. Nullable, no backfill.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "appleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_appleId_key" ON "User"("appleId");
