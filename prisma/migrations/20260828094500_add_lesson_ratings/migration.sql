-- CreateTable
CREATE TABLE "LessonRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "sessionId" TEXT,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LessonRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LessonRating_userId_createdAt_idx" ON "LessonRating"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonRating_lessonId_createdAt_idx" ON "LessonRating"("lessonId", "createdAt");

-- CreateIndex
CREATE INDEX "LessonRating_userId_lessonId_idx" ON "LessonRating"("userId", "lessonId");

-- AddForeignKey
ALTER TABLE "LessonRating" ADD CONSTRAINT "LessonRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
