-- CreateTable
CREATE TABLE "MiniGameScoreAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "passed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MiniGameScoreAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MiniGameScoreAttempt_gameId_createdAt_idx" ON "MiniGameScoreAttempt"("gameId", "createdAt");

-- CreateIndex
CREATE INDEX "MiniGameScoreAttempt_kind_createdAt_idx" ON "MiniGameScoreAttempt"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "MiniGameScoreAttempt_userId_gameId_createdAt_idx" ON "MiniGameScoreAttempt"("userId", "gameId", "createdAt");

-- AddForeignKey
ALTER TABLE "MiniGameScoreAttempt" ADD CONSTRAINT "MiniGameScoreAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
