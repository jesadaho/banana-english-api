-- Free banana pool (daily cap). Spends before IAP / bonus bananas.
ALTER TABLE "User" ADD COLUMN "freeBananaBalance" INTEGER NOT NULL DEFAULT 0;

UPDATE "User"
SET "freeBananaBalance" = LEAST("bananaBalance", 5);
