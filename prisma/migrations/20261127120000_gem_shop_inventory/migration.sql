-- Gem Shop inventory: streak shields / revivals and alternate app icons.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "streakShieldCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "streakRevivalCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "unlockedAppIconIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "activeAppIconId" TEXT;
