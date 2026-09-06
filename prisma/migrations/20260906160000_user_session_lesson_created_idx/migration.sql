-- Speeds up "recent learners for lesson" lookups on intro screens.
CREATE INDEX IF NOT EXISTS "UserSession_lessonId_createdAt_idx"
  ON "UserSession"("lessonId", "createdAt");
