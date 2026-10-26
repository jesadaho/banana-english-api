-- CreateTable
CREATE TABLE "UserPerfectStar" (
    "userId" TEXT NOT NULL,
    "game" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPerfectStar_pkey" PRIMARY KEY ("userId","game","poolId")
);

-- AddForeignKey
ALTER TABLE "UserPerfectStar" ADD CONSTRAINT "UserPerfectStar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
