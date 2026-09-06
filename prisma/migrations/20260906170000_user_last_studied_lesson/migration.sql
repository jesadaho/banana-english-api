-- Track "last training lesson" for intro social proof (current lesson only).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastStudiedLessonId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastStudiedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastStudiedLessonId_lastStudiedAt_idx"
  ON "User"("lastStudiedLessonId", "lastStudiedAt");

-- One-time backfill from latest training session per user.
UPDATE "User" AS u
SET
  "lastStudiedLessonId" = s."lessonId",
  "lastStudiedAt" = s."createdAt"
FROM (
  SELECT DISTINCT ON ("userId")
    "userId",
    "lessonId",
    "createdAt"
  FROM "UserSession"
  WHERE "sessionType" = 'training'
    AND "lessonId" IS NOT NULL
  ORDER BY "userId", "createdAt" DESC
) AS s
WHERE u.id = s."userId"
  AND u."lastStudiedLessonId" IS NULL;
