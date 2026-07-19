-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unlockedAvatarIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
