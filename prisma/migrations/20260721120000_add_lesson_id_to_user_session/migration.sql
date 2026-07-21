-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "lessonId" TEXT;

-- CreateIndex
CREATE INDEX "UserSession_userId_lessonId_idx" ON "UserSession"("userId", "lessonId");
