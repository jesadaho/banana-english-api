-- AlterTable
ALTER TABLE "User" ADD COLUMN "reminderSlot" TEXT;
ALTER TABLE "User" ADD COLUMN "dailyPracticeTemplateIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
