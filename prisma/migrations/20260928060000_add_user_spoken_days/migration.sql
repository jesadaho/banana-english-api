-- CreateTable
CREATE TABLE "UserSpokenDay" (
    "userId" TEXT NOT NULL,
    "day" DATE NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "dailySpeakCompletions" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "UserSpokenDay_pkey" PRIMARY KEY ("userId","day")
);

-- CreateIndex
CREATE INDEX "UserSpokenDay_day_idx" ON "UserSpokenDay"("day");

-- AddForeignKey
ALTER TABLE "UserSpokenDay" ADD CONSTRAINT "UserSpokenDay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
