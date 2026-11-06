-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'ENDED', 'FINALIZING', 'REWARDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventRewardType" AS ENUM ('AVATAR');

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "gameKey" TEXT NOT NULL,
    "topicId" TEXT,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoDistributeRewards" BOOLEAN NOT NULL DEFAULT true,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "rewardHold" BOOLEAN NOT NULL DEFAULT false,
    "headlineTh" TEXT,
    "headlineEn" TEXT,
    "bannerImageUrl" TEXT,
    "ctaRoute" TEXT,
    "startNotifiedAt" TIMESTAMP(3),
    "endingSoonNotifiedAt" TIMESTAMP(3),
    "endedNotifiedAt" TIMESTAMP(3),
    "snapshotAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRewardTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "rankFrom" INTEGER NOT NULL,
    "rankTo" INTEGER NOT NULL,
    "rewardType" "EventRewardType" NOT NULL DEFAULT 'AVATAR',
    "avatarId" TEXT NOT NULL,
    "avatarImageUrl" TEXT,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRewardTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventLeaderboard" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bestScore" INTEGER NOT NULL,
    "playCount" INTEGER NOT NULL DEFAULT 1,
    "displayName" TEXT,
    "avatarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventLeaderboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventScoreAttempt" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "topicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventScoreAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventResult" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "displayName" TEXT,
    "avatarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventRewardGrant" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rewardTierId" TEXT NOT NULL,
    "avatarId" TEXT NOT NULL,
    "avatarImageUrl" TEXT,
    "nameTh" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "seenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventRewardGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventJobLock" (
    "id" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventJobLock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_gameKey_status_idx" ON "Event"("gameKey", "status");

-- CreateIndex
CREATE INDEX "Event_status_startsAt_endsAt_idx" ON "Event"("status", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "EventRewardTier_eventId_rankFrom_idx" ON "EventRewardTier"("eventId", "rankFrom");

-- CreateIndex
CREATE UNIQUE INDEX "EventLeaderboard_eventId_userId_key" ON "EventLeaderboard"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventLeaderboard_eventId_bestScore_idx" ON "EventLeaderboard"("eventId", "bestScore");

-- CreateIndex
CREATE INDEX "EventScoreAttempt_eventId_userId_createdAt_idx" ON "EventScoreAttempt"("eventId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "EventScoreAttempt_eventId_createdAt_idx" ON "EventScoreAttempt"("eventId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventResult_eventId_userId_key" ON "EventResult"("eventId", "userId");

-- CreateIndex
CREATE INDEX "EventResult_eventId_rank_idx" ON "EventResult"("eventId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "EventRewardGrant_eventId_userId_rewardTierId_key" ON "EventRewardGrant"("eventId", "userId", "rewardTierId");

-- CreateIndex
CREATE INDEX "EventRewardGrant_userId_seenAt_idx" ON "EventRewardGrant"("userId", "seenAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventJobLock_jobKey_runKey_key" ON "EventJobLock"("jobKey", "runKey");

-- AddForeignKey
ALTER TABLE "EventRewardTier" ADD CONSTRAINT "EventRewardTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLeaderboard" ADD CONSTRAINT "EventLeaderboard_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLeaderboard" ADD CONSTRAINT "EventLeaderboard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScoreAttempt" ADD CONSTRAINT "EventScoreAttempt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventScoreAttempt" ADD CONSTRAINT "EventScoreAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventResult" ADD CONSTRAINT "EventResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRewardGrant" ADD CONSTRAINT "EventRewardGrant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRewardGrant" ADD CONSTRAINT "EventRewardGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRewardGrant" ADD CONSTRAINT "EventRewardGrant_rewardTierId_fkey" FOREIGN KEY ("rewardTierId") REFERENCES "EventRewardTier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
