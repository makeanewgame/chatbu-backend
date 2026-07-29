-- CreateTable
CREATE TABLE "BookingSmsVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "botCuid" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingSmsVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BookingSmsVerification_phone_botCuid_idx" ON "BookingSmsVerification"("phone", "botCuid");

-- CreateIndex
CREATE INDEX "BookingSmsVerification_expiresAt_idx" ON "BookingSmsVerification"("expiresAt");
