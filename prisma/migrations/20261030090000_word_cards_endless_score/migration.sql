-- CreateTable
CREATE TABLE "WordCardsEndlessScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekKey" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "displayName" TEXT,
    "avatarId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WordCardsEndlessScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WordCardsEndlessScore_weekKey_bestScore_idx" ON "WordCardsEndlessScore"("weekKey", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "WordCardsEndlessScore_userId_weekKey_key" ON "WordCardsEndlessScore"("userId", "weekKey");

-- AddForeignKey
ALTER TABLE "WordCardsEndlessScore" ADD CONSTRAINT "WordCardsEndlessScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
