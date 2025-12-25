/*
  Warnings:

  - A unique constraint covering the columns `[invitationToken]` on the table `TeamMember` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[teamId,email]` on the table `TeamMember` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TeamMember" ADD COLUMN     "email" TEXT,
ADD COLUMN     "invitationToken" TEXT,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ALTER COLUMN "userId" DROP NOT NULL,
ALTER COLUMN "role" SET DEFAULT 'TEAM_MEMBER';

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_invitationToken_key" ON "TeamMember"("invitationToken");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_teamId_email_key" ON "TeamMember"("teamId", "email");
