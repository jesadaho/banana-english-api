-- AlterTable
ALTER TABLE "Article" ADD COLUMN "viewCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Article" ADD COLUMN "clapCount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ArticleEngagement" (
    "id" TEXT NOT NULL,
    "articleId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "viewed" BOOLEAN NOT NULL DEFAULT false,
    "clapCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArticleEngagement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ArticleEngagement_articleId_idx" ON "ArticleEngagement"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleEngagement_articleId_visitorId_key" ON "ArticleEngagement"("articleId", "visitorId");

-- AddForeignKey
ALTER TABLE "ArticleEngagement" ADD CONSTRAINT "ArticleEngagement_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE CASCADE ON UPDATE CASCADE;
