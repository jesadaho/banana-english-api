-- Social proof on minigame / mission intros (who last started this content).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActivityKind" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActivityId" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastActivityAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "User_lastActivityKind_lastActivityId_lastActivityAt_idx"
  ON "User"("lastActivityKind", "lastActivityId", "lastActivityAt");
