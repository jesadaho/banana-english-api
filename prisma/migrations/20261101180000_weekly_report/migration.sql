-- AlterTable
ALTER TABLE "User" ADD COLUMN "weeklyReportTemplateIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN "contentLocale" TEXT NOT NULL DEFAULT 'th';

-- CreateIndex
CREATE INDEX "User_lastAppOpenDate_idx" ON "User"("lastAppOpenDate");

-- CreateTable
CREATE TABLE "WeeklyReportSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "segment" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "locale" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WeeklyReportSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReportSnapshot_userId_weekKey_key" ON "WeeklyReportSnapshot"("userId", "weekKey");

-- CreateIndex
CREATE INDEX "WeeklyReportSnapshot_createdAt_idx" ON "WeeklyReportSnapshot"("createdAt");

-- AddForeignKey
ALTER TABLE "WeeklyReportSnapshot" ADD CONSTRAINT "WeeklyReportSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
