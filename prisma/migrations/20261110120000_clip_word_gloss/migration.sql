-- Clips: tap-a-word meaning cache (AI gloss in context)
CREATE TABLE "ClipWordGloss" (
    "id" TEXT NOT NULL,
    "sentenceId" TEXT NOT NULL,
    "wordIdx" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "lemma" TEXT NOT NULL DEFAULT '',
    "pos" TEXT NOT NULL DEFAULT '',
    "th" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "example" TEXT NOT NULL DEFAULT '',
    "exampleTh" TEXT NOT NULL DEFAULT '',
    "ipa" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClipWordGloss_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClipWordGloss_sentenceId_wordIdx_key" ON "ClipWordGloss"("sentenceId", "wordIdx");

ALTER TABLE "ClipWordGloss" ADD CONSTRAINT "ClipWordGloss_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "ClipSentence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
