-- CreateTable
CREATE TABLE "LiveTalkRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
    "feedback" TEXT,
    "listenedSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveTalkRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveTalkRating_userId_roomId_key" ON "LiveTalkRating"("userId", "roomId");

-- CreateIndex
CREATE INDEX "LiveTalkRating_userId_createdAt_idx" ON "LiveTalkRating"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LiveTalkRating_roomId_rating_createdAt_idx" ON "LiveTalkRating"("roomId", "rating", "createdAt");

-- CreateIndex
CREATE INDEX "LiveTalkRating_rating_createdAt_idx" ON "LiveTalkRating"("rating", "createdAt");

-- AddForeignKey
ALTER TABLE "LiveTalkRating" ADD CONSTRAINT "LiveTalkRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTalkRating" ADD CONSTRAINT "LiveTalkRating_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveTalkRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
