-- CreateTable
CREATE TABLE "UserActiveDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "UserActiveDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "UserActiveDay_day_idx" ON "UserActiveDay"("day");

-- AddForeignKey
ALTER TABLE "UserActiveDay" ADD CONSTRAINT "UserActiveDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
