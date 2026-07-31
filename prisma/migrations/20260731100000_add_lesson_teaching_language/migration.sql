-- AlterTable
ALTER TABLE "User" ADD COLUMN "lessonTeachingLanguage" TEXT NOT NULL DEFAULT 'thai';

-- AlterTable
ALTER TABLE "UserSession" ADD COLUMN "teachingLanguage" TEXT;
