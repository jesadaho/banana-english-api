-- Event theme / accent colors for admin + in-app banner styling.
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "themeColor" TEXT;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "accentColor" TEXT;

-- Reward-tier avatar circle background.
ALTER TABLE "EventRewardTier" ADD COLUMN IF NOT EXISTS "avatarBgColor" TEXT;
