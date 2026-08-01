-- CreateEnum
CREATE TYPE "LegalDocumentVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TranslationStatus" AS ENUM ('SOURCE', 'NEEDS_TRANSLATION', 'TRANSLATED', 'APPROVED');

-- CreateEnum
CREATE TYPE "LegalAcceptanceContext" AS ENUM ('PURCHASE', 'SIGNUP', 'OTHER');

-- AlterTable
ALTER TABLE "LeadPrivacyConsent" ADD COLUMN     "legalDocumentVersionId" TEXT,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'tr';

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentVersion" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" "LegalDocumentVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByAdminId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentContent" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bodyMarkdown" TEXT NOT NULL,
    "translationStatus" "TranslationStatus" NOT NULL DEFAULT 'NEEDS_TRANSLATION',
    "translatedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByAdminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalDocumentContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalDocumentAcceptance" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "context" "LegalAcceptanceContext" NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" TEXT,
    "teamId" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocumentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_slug_key" ON "LegalDocument"("slug");

-- CreateIndex
CREATE INDEX "LegalDocumentVersion_documentId_status_idx" ON "LegalDocumentVersion"("documentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentVersion_documentId_versionNumber_key" ON "LegalDocumentVersion"("documentId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocumentContent_versionId_locale_key" ON "LegalDocumentContent"("versionId", "locale");

-- CreateIndex
CREATE INDEX "LegalDocumentAcceptance_documentId_versionId_idx" ON "LegalDocumentAcceptance"("documentId", "versionId");

-- CreateIndex
CREATE INDEX "LegalDocumentAcceptance_subjectType_subjectId_idx" ON "LegalDocumentAcceptance"("subjectType", "subjectId");

-- AddForeignKey
ALTER TABLE "LegalDocumentVersion" ADD CONSTRAINT "LegalDocumentVersion_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "LegalDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentContent" ADD CONSTRAINT "LegalDocumentContent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalDocumentAcceptance" ADD CONSTRAINT "LegalDocumentAcceptance_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "LegalDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

