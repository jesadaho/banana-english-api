-- The one Founder Presale charge from the payment test should not hold a seat
-- or leave Pro Max on that account. Later paid orders are left alone.
UPDATE "User" AS u
SET "subscriptionTier" = 'FREE',
    "subscriptionExpiresAt" = NULL
WHERE u.id IN (
  SELECT "userId"
  FROM "PresaleOrder"
  WHERE status = 'paid'
    AND "createdAt" < TIMESTAMPTZ '2026-10-16 15:00:00+00'
);

UPDATE "PresaleOrder"
SET status = 'voided'
WHERE status = 'paid'
  AND "createdAt" < TIMESTAMPTZ '2026-10-16 15:00:00+00';
