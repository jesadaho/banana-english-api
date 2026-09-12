-- CreateTable
CREATE TABLE "PurchaseAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "appUserId" TEXT,
    "productId" TEXT NOT NULL,
    "storeTransactionId" TEXT NOT NULL,
    "platform" TEXT,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseAttempt_storeTransactionId_idx" ON "PurchaseAttempt"("storeTransactionId");

-- CreateIndex
CREATE INDEX "PurchaseAttempt_userId_createdAt_idx" ON "PurchaseAttempt"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseAttempt_status_createdAt_idx" ON "PurchaseAttempt"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PurchaseAttempt" ADD CONSTRAINT "PurchaseAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
