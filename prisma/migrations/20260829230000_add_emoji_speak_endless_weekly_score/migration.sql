-- CreateTable
CREATE TABLE "EmojiSpeakEndlessWeeklyScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "displayName" TEXT,
    "avatarId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmojiSpeakEndlessWeeklyScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmojiSpeakEndlessWeeklyScore_weekKey_bestScore_idx" ON "EmojiSpeakEndlessWeeklyScore"("weekKey", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "EmojiSpeakEndlessWeeklyScore_userId_weekKey_key" ON "EmojiSpeakEndlessWeeklyScore"("userId", "weekKey");

-- AddForeignKey
ALTER TABLE "EmojiSpeakEndlessWeeklyScore" ADD CONSTRAINT "EmojiSpeakEndlessWeeklyScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
