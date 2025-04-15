/*
  Warnings:

  - Added the required column `status` to the `Storage` table without a default value. This is not possible if the table is not empty.
  - Added the required column `taskId` to the `Storage` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Storage" ADD COLUMN     "ingestionInfo" JSONB,
ADD COLUMN     "status" TEXT NOT NULL,
ADD COLUMN     "taskId" TEXT NOT NULL;
