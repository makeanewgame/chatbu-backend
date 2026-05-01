-- CreateTable
CREATE TABLE "BookingVerification" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "botCuid" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingVerification_email_botCuid_idx" ON "BookingVerification"("email", "botCuid");

-- CreateIndex
CREATE INDEX "BookingVerification_expiresAt_idx" ON "BookingVerification"("expiresAt");
