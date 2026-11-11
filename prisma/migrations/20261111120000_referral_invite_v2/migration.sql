-- AlterTable
ALTER TABLE "Referral" ADD COLUMN "program" TEXT NOT NULL DEFAULT 'banana_v1';
ALTER TABLE "Referral" ADD COLUMN "couponExpiresAt" TIMESTAMP(3);
ALTER TABLE "Referral" ADD COLUMN "couponUsedAt" TIMESTAMP(3);
ALTER TABLE "Referral" ADD COLUMN "inviteePurchasedAt" TIMESTAMP(3);
ALTER TABLE "Referral" ADD COLUMN "referrerGrantId" TEXT;

-- CreateIndex
CREATE INDEX "Referral_program_status_idx" ON "Referral"("program", "status");
