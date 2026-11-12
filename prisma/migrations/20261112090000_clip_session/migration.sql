-- Clips: one row per mode opened on a clip page (admin session counts)
CREATE TABLE "ClipSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClipSession_createdAt_mode_idx" ON "ClipSession"("createdAt", "mode");
CREATE INDEX "ClipSession_clipId_mode_createdAt_idx" ON "ClipSession"("clipId", "mode", "createdAt");
CREATE INDEX "ClipSession_userId_createdAt_idx" ON "ClipSession"("userId", "createdAt");

ALTER TABLE "ClipSession" ADD CONSTRAINT "ClipSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipSession" ADD CONSTRAINT "ClipSession_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
