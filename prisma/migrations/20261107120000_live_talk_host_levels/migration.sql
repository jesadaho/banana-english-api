-- Live Talk host levels (Trainee / Host / Official), co-host role, invites, audit log.
ALTER TABLE "User" ADD COLUMN "hostLevel" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "User" ADD COLUMN "hostLevelAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "hostRulesAcceptedAt" TIMESTAMP(3);

ALTER TABLE "LiveTalkParticipant" ADD COLUMN "cohostSince" TIMESTAMP(3);

CREATE TABLE "HostLevelEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromLevel" TEXT NOT NULL,
    "toLevel" TEXT NOT NULL,
    "actorUserId" TEXT,
    "reason" TEXT NOT NULL,
    "note" TEXT,
    "roomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HostLevelEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "HostLevelEvent_userId_createdAt_idx" ON "HostLevelEvent"("userId", "createdAt");
ALTER TABLE "HostLevelEvent" ADD CONSTRAINT "HostLevelEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HostLevelEvent" ADD CONSTRAINT "HostLevelEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LiveTalkInvite" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LiveTalkInvite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LiveTalkInvite_inviteeId_status_idx" ON "LiveTalkInvite"("inviteeId", "status");
CREATE INDEX "LiveTalkInvite_roomId_status_idx" ON "LiveTalkInvite"("roomId", "status");
ALTER TABLE "LiveTalkInvite" ADD CONSTRAINT "LiveTalkInvite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "LiveTalkRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTalkInvite" ADD CONSTRAINT "LiveTalkInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LiveTalkInvite" ADD CONSTRAINT "LiveTalkInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing community admins already run rooms: they start as Official Hosts.
UPDATE "User" SET "hostLevel" = 'official', "hostLevelAt" = CURRENT_TIMESTAMP WHERE "communityAdmin" = true;
