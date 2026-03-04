-- AlterTable
ALTER TABLE "User"
ADD COLUMN IF NOT EXISTS "termsAccepted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Integrations" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integrations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'Integrations_teamId_fkey'
    ) THEN
        ALTER TABLE "Integrations"
        ADD CONSTRAINT "Integrations_teamId_fkey"
        FOREIGN KEY ("teamId") REFERENCES "Team"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
