-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "botId" TEXT NOT NULL,
    "calendarEventId" TEXT NOT NULL,
    "attendeeName" TEXT NOT NULL,
    "attendeePhone" TEXT NOT NULL,
    "attendeeEmail" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reminderStates" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Appointment_botId_idx" ON "Appointment"("botId");

-- CreateIndex
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");

-- CreateIndex
CREATE UNIQUE INDEX "Appointment_botId_calendarEventId_key" ON "Appointment"("botId", "calendarEventId");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_botId_fkey" FOREIGN KEY ("botId") REFERENCES "CustomerBots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
