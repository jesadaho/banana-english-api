-- Clips tab: YouTube clips with timed sentences + per-user progress
CREATE TABLE "Clip" (
    "id" TEXT NOT NULL,
    "youtubeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleTh" TEXT NOT NULL DEFAULT '',
    "level" TEXT NOT NULL DEFAULT 'A2',
    "category" TEXT NOT NULL DEFAULT 'daily',
    "durationSec" INTEGER NOT NULL DEFAULT 0,
    "thumbnailUrl" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Clip_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Clip_status_category_sortOrder_idx" ON "Clip"("status", "category", "sortOrder");

CREATE TABLE "ClipSentence" (
    "id" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "idx" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "textTh" TEXT NOT NULL DEFAULT '',
    "dictation" JSONB,
    CONSTRAINT "ClipSentence_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClipSentence_clipId_idx_key" ON "ClipSentence"("clipId", "idx");
ALTER TABLE "ClipSentence" ADD CONSTRAINT "ClipSentence_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClipProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clipId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "lastIdx" INTEGER NOT NULL DEFAULT 0,
    "doneCount" INTEGER NOT NULL DEFAULT 0,
    "correctCount" INTEGER NOT NULL DEFAULT 0,
    "scoreSum" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClipProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ClipProgress_userId_clipId_mode_key" ON "ClipProgress"("userId", "clipId", "mode");
CREATE INDEX "ClipProgress_userId_updatedAt_idx" ON "ClipProgress"("userId", "updatedAt");
ALTER TABLE "ClipProgress" ADD CONSTRAINT "ClipProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClipProgress" ADD CONSTRAINT "ClipProgress_clipId_fkey" FOREIGN KEY ("clipId") REFERENCES "Clip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
