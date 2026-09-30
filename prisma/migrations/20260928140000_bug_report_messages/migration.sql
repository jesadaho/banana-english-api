-- CreateTable
CREATE TABLE "BugReportMessage" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BugReportMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BugReportMessage_reportId_createdAt_idx" ON "BugReportMessage"("reportId", "createdAt");

-- AddForeignKey
ALTER TABLE "BugReportMessage" ADD CONSTRAINT "BugReportMessage_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "BugReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
