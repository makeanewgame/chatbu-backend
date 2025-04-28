/*
  Warnings:

  - You are about to drop the column `contentName` on the `Content` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Content" DROP COLUMN "contentName",
ADD COLUMN     "content" JSONB;
