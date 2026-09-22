-- CreateTable
CREATE TABLE "FoundationChapterSkip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "skippedNodeIds" JSONB NOT NULL,
    "quizCorrect" INTEGER NOT NULL,
    "quizTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FoundationChapterSkip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoundationSkipQuizAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "targetChapterId" TEXT NOT NULL,
    "previousChapterId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "bananaCost" INTEGER NOT NULL DEFAULT 1,
    "spendRef" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'started',
    "correctCount" INTEGER,
    "passed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoundationSkipQuizAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoundationChapterSkip_userId_pathId_idx" ON "FoundationChapterSkip"("userId", "pathId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationChapterSkip_userId_pathId_chapterId_key" ON "FoundationChapterSkip"("userId", "pathId", "chapterId");

-- CreateIndex
CREATE INDEX "FoundationSkipQuizAttempt_userId_pathId_targetChapterId_idx" ON "FoundationSkipQuizAttempt"("userId", "pathId", "targetChapterId");

-- CreateIndex
CREATE UNIQUE INDEX "FoundationSkipQuizAttempt_userId_idempotencyKey_key" ON "FoundationSkipQuizAttempt"("userId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "FoundationChapterSkip" ADD CONSTRAINT "FoundationChapterSkip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoundationSkipQuizAttempt" ADD CONSTRAINT "FoundationSkipQuizAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
