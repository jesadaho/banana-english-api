-- Official Host booked Live Talk sessions (host web /host)
CREATE TABLE "LiveTalkSession" (
    "id" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 60,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveTalkSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LiveTalkSession_status_startsAt_idx" ON "LiveTalkSession"("status", "startsAt");
CREATE INDEX "LiveTalkSession_hostUserId_startsAt_idx" ON "LiveTalkSession"("hostUserId", "startsAt");

ALTER TABLE "LiveTalkSession" ADD CONSTRAINT "LiveTalkSession_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
