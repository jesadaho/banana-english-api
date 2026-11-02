-- AlterTable
ALTER TABLE "User" ADD COLUMN "communityAdmin" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "LiveTalkRoom" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "minSpeakLevel" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "livekitRoomName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'live',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "LiveTalkRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveTalkParticipant" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "LiveTalkParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveTalkRoom_livekitRoomName_key" ON "LiveTalkRoom"("livekitRoomName");

-- CreateIndex
CREATE INDEX "LiveTalkRoom_status_createdAt_idx" ON "LiveTalkRoom"("status", "createdAt");

-- CreateIndex
CREATE INDEX "LiveTalkParticipant_roomId_leftAt_idx" ON "LiveTalkParticipant"("roomId", "leftAt");

-- CreateIndex
CREATE INDEX "LiveTalkParticipant_userId_leftAt_idx" ON "LiveTalkParticipant"("userId", "leftAt");

-- AddForeignKey
ALTER TABLE "LiveTalkRoom" ADD CONSTRAINT "LiveTalkRoom_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTalkParticipant" ADD CONSTRAINT "LiveTalkParticipant_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveTalkRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveTalkParticipant" ADD CONSTRAINT "LiveTalkParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
