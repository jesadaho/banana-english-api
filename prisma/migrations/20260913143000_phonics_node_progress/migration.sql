-- CreateTable
CREATE TABLE "PhonicsNodeProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhonicsNodeProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhonicsNodeProgress_userId_passed_idx" ON "PhonicsNodeProgress"("userId", "passed");

-- CreateIndex
CREATE UNIQUE INDEX "PhonicsNodeProgress_userId_nodeId_key" ON "PhonicsNodeProgress"("userId", "nodeId");

-- AddForeignKey
ALTER TABLE "PhonicsNodeProgress" ADD CONSTRAINT "PhonicsNodeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
