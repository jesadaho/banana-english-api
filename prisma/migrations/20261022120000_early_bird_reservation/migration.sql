ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "earlyBirdReservedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "earlyBirdReserveSource" TEXT;
CREATE INDEX IF NOT EXISTS "User_earlyBirdReservedAt_idx" ON "User"("earlyBirdReservedAt");

ALTER TABLE "SubscriptionGrant" ADD COLUMN IF NOT EXISTS "productId" TEXT;
ALTER TABLE "SubscriptionGrant" ADD COLUMN IF NOT EXISTS "storeTransactionId" TEXT;
ALTER TABLE "SubscriptionGrant" ADD COLUMN IF NOT EXISTS "platform" TEXT;
ALTER TABLE "SubscriptionGrant" ADD COLUMN IF NOT EXISTS "isSandbox" BOOLEAN;
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionGrant_storeTransactionId_key" ON "SubscriptionGrant"("storeTransactionId");
CREATE INDEX IF NOT EXISTS "SubscriptionGrant_productId_createdAt_idx" ON "SubscriptionGrant"("productId", "createdAt");
