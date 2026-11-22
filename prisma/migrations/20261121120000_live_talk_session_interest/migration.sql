-- CreateTable
CREATE TABLE "LiveTalkSessionInterest" (
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remindedAt" TIMESTAMP(3),

    CONSTRAINT "LiveTalkSessionInterest_pkey" PRIMARY KEY ("sessionId","userId")
);

-- CreateIndex
CREATE INDEX "LiveTalkSessionInterest_userId_idx" ON "LiveTalkSessionInterest"("userId");

-- AddForeignKey
ALTER TABLE "LiveTalkSessionInterest" ADD CONSTRAINT "LiveTalkSessionInterest_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveTalkSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTalkSessionInterest" ADD CONSTRAINT "LiveTalkSessionInterest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
