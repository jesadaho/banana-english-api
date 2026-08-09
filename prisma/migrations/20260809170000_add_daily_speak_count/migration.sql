-- AlterTable
ALTER TABLE "User" ADD COLUMN "dailySpeakCount" INTEGER NOT NULL DEFAULT 0;

-- Backfill from prior Daily Speak XP claims (one XP txn per completed day).
UPDATE "User" AS u
SET "dailySpeakCount" = sub.cnt
FROM (
  SELECT "userId", COUNT(*)::int AS cnt
  FROM "EconomyTransaction"
  WHERE source = 'daily_speak_reward'
    AND currency = 'XP'
  GROUP BY "userId"
) AS sub
WHERE u.id = sub."userId";
