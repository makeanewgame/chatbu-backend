-- AlterTable
ALTER TABLE "CustomerBots" ADD COLUMN "appointmentReminderOffsets" INTEGER[] DEFAULT ARRAY[1440, 60]::INTEGER[];
