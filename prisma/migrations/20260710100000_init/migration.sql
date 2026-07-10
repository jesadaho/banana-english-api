-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('BANANA', 'XP', 'BANANA_SEED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "displayName" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Bangkok',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "bananaBalance" INTEGER NOT NULL DEFAULT 0,
    "xpBalance" INTEGER NOT NULL DEFAULT 0,
    "bananaSeedBalance" INTEGER NOT NULL DEFAULT 0,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "lastSessionDate" DATE,
    "streakMilestonesClaimed" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "lastDailyBananaDate" DATE,
    "lastAppOpenDate" DATE,
    "dailyMissionUsedDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EconomyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "Currency" NOT NULL,
    "amount" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EconomyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFcmToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFcmToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sentOn" DATE NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "simulationId" TEXT,
    "isDailyMission" BOOLEAN NOT NULL DEFAULT false,
    "rewardsApplied" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_anonymousId_key" ON "User"("anonymousId");

-- CreateIndex
CREATE INDEX "EconomyTransaction_userId_createdAt_idx" ON "EconomyTransaction"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "UserFcmToken_token_key" ON "UserFcmToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_type_sentOn_key" ON "NotificationLog"("userId", "type", "sentOn");

-- CreateIndex
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");

-- AddForeignKey
ALTER TABLE "EconomyTransaction" ADD CONSTRAINT "EconomyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFcmToken" ADD CONSTRAINT "UserFcmToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSession" ADD CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
