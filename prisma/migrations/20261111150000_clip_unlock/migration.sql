-- Clips practice lock: free / banana unlocks per user × clip
CREATE TABLE "ClipUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipUnlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClipUnlock_userId_clipId_idx" ON "ClipUnlock"("userId", "clipId");
CREATE INDEX "ClipUnlock_userId_kind_idx" ON "ClipUnlock"("userId", "kind");

ALTER TABLE "ClipUnlock" ADD CONSTRAINT "ClipUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipUnlock" ADD CONSTRAINT "ClipUnlock_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
