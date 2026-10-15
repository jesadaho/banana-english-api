-- Spoken lines sent without a banked clip. One row per sentence.
CREATE TABLE "TtsLiveLine" (
    "textKey" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "hitCount" INTEGER NOT NULL DEFAULT 1,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TtsLiveLine_pkey" PRIMARY KEY ("textKey")
);

CREATE INDEX "TtsLiveLine_hitCount_idx" ON "TtsLiveLine"("hitCount");
CREATE INDEX "TtsLiveLine_lastSeenAt_idx" ON "TtsLiveLine"("lastSeenAt");
CREATE INDEX "TtsLiveLine_source_hitCount_idx" ON "TtsLiveLine"("source", "hitCount");
