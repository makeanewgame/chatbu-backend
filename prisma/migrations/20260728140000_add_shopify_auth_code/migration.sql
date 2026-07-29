-- CreateTable
CREATE TABLE "ShopifyAuthCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "ShopifyAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShopifyAuthCode_codeHash_idx" ON "ShopifyAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "ShopifyAuthCode_expiresAt_idx" ON "ShopifyAuthCode"("expiresAt");
