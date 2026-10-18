-- Allow Founder Presale checkout before an app User exists.
-- Paid rows with null userId are claimed when the same Firebase UID logs in.

ALTER TABLE "PresaleOrder" ADD COLUMN "firebaseUid" TEXT;

UPDATE "PresaleOrder" AS o
SET "firebaseUid" = u."firebaseUid"
FROM "User" AS u
WHERE o."userId" = u.id
  AND u."firebaseUid" IS NOT NULL;

UPDATE "PresaleOrder"
SET "firebaseUid" = "userId"
WHERE "firebaseUid" IS NULL;

ALTER TABLE "PresaleOrder" ALTER COLUMN "firebaseUid" SET NOT NULL;

ALTER TABLE "PresaleOrder" DROP CONSTRAINT "PresaleOrder_userId_fkey";
ALTER TABLE "PresaleOrder" ALTER COLUMN "userId" DROP NOT NULL;
ALTER TABLE "PresaleOrder" ADD CONSTRAINT "PresaleOrder_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "PresaleOrder_firebaseUid_status_idx"
  ON "PresaleOrder"("firebaseUid", "status");
