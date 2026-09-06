-- Selected avatar for social surfaces (lesson intro, etc.).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "avatarId" TEXT;
