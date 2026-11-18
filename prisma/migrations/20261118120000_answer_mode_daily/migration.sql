-- Tap Mode analytics: answers per day / node kind / input mode (speak vs tap)
CREATE TABLE "AnswerModeDaily" (
    "day" DATE NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "correct" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "AnswerModeDaily_pkey" PRIMARY KEY ("day","userId","kind","mode")
);

CREATE INDEX "AnswerModeDaily_day_kind_mode_idx" ON "AnswerModeDaily"("day", "kind", "mode");

ALTER TABLE "AnswerModeDaily" ADD CONSTRAINT "AnswerModeDaily_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
