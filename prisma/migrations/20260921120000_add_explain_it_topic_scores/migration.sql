-- CreateTable
CREATE TABLE "ExplainItTopicScore" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "displayName" TEXT,
    "avatarId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExplainItTopicScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExplainItTopicScore_topicId_bestScore_idx" ON "ExplainItTopicScore"("topicId", "bestScore");

-- CreateIndex
CREATE UNIQUE INDEX "ExplainItTopicScore_userId_topicId_key" ON "ExplainItTopicScore"("userId", "topicId");

-- AddForeignKey
ALTER TABLE "ExplainItTopicScore" ADD CONSTRAINT "ExplainItTopicScore_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
