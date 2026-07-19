-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "overallScore" INTEGER,
ADD COLUMN     "scoreLabel" TEXT,
ADD COLUMN     "xpEarned" INTEGER,
ADD COLUMN     "seedsEarned" INTEGER,
ADD COLUMN     "durationSeconds" INTEGER,
ADD COLUMN     "reportJson" JSONB;

-- CreateIndex
CREATE INDEX "UserSession_userId_completedAt_idx" ON "UserSession"("userId", "completedAt");
