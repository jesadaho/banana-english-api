-- Live Talk no longer keys off communityAdmin; keep those users as Official Hosts.
UPDATE "User"
SET "hostLevel" = 'official',
    "hostLevelAt" = COALESCE("hostLevelAt", CURRENT_TIMESTAMP)
WHERE "communityAdmin" = true
  AND "hostLevel" <> 'official';
