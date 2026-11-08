-- AlterTable
ALTER TABLE "LiveTalkParticipant" ADD COLUMN "mutedByHost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "LiveTalkParticipant" ADD COLUMN "kickedAt" TIMESTAMP(3);
