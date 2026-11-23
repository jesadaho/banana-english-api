-- Paywall default-plan A/B test: arm + first exposure time
ALTER TABLE "User" ADD COLUMN "paywallArm" TEXT;
ALTER TABLE "User" ADD COLUMN "paywallArmAt" TIMESTAMP(3);
