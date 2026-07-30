-- AlterTable
ALTER TABLE "UserAchievement" ADD COLUMN "claimedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserOutfit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "outfitId" TEXT NOT NULL,
    "sourceAchievementId" TEXT,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserOutfit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserOutfit_userId_idx" ON "UserOutfit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOutfit_userId_outfitId_key" ON "UserOutfit"("userId", "outfitId");

-- AddForeignKey
ALTER TABLE "UserOutfit" ADD CONSTRAINT "UserOutfit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
