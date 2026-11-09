-- Clips from non-YouTube sources (VOA Learning English mp4)
ALTER TABLE "Clip" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'youtube';
ALTER TABLE "Clip" ADD COLUMN "videoUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clip" ADD COLUMN "sourceUrl" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clip" ADD COLUMN "credit" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Clip" ALTER COLUMN "youtubeId" SET DEFAULT '';
CREATE INDEX "Clip_sourceUrl_idx" ON "Clip"("sourceUrl");
