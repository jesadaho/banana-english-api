-- AlterTable
ALTER TABLE "MiniGameScoreAttempt" ADD COLUMN "hintsUsed" INTEGER,
ADD COLUMN "assisted" BOOLEAN;

-- CreateTable
CREATE TABLE "InteractiveScenarioProgress" (
    "userId" TEXT NOT NULL,
    "scenarioId" TEXT NOT NULL,
    "completedSceneIds" JSONB NOT NULL,
    "checkpoints" JSONB NOT NULL,
    "goalOutcomes" JSONB NOT NULL,
    "slots" JSONB NOT NULL,
    "finishedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InteractiveScenarioProgress_pkey" PRIMARY KEY ("userId","scenarioId")
);

-- AddForeignKey
ALTER TABLE "InteractiveScenarioProgress" ADD CONSTRAINT "InteractiveScenarioProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
