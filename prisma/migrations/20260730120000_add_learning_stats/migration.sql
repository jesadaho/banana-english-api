-- AlterTable
ALTER TABLE "User" ADD COLUMN "longestStreakDays" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "learnerTurnCount" INTEGER;

-- Backfill longest streak from current streak or highest claimed milestone.
UPDATE "User" SET "longestStreakDays" = GREATEST(
  "streakDays",
  COALESCE((SELECT MAX(m) FROM unnest("streakMilestonesClaimed") AS m), 0)
);
