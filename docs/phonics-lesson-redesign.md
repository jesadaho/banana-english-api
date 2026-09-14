# Clear English: Phonics as speaking lessons

Backend-only playtest implementation. No frontend edits, deployment, migration, new game engine, generated media, or changes to existing reward amounts.

## Catalog v2

`GET /phonics/course` now returns the **54-lesson** Clear English catalog:

1. Unlock the Sound Code — 10 new lessons
2. Patterns That Travel — 10 new lessons
3. Clear Sounds for Thai Speakers — 8 existing lessons
4. Clean Word Endings — 8 existing lessons
5. Tune Your Vowels — 6 existing lessons
6. Find the Beat — 6 existing lessons
7. Speak in Smooth Chunks — 6 existing lessons

This is an intentional catalog contract/version change, not a compatible extension of the old quiz response. Clients must branch on version `2.0.0-lesson-playtest` and node `sessionType: training`. Do not send these nodes to the legacy phonics check API.

The previous 18-node preview remains available at `GET /phonics/course/legacy`. Its node/check endpoints and stored quiz progress are retained for existing consumers, but those results do not complete the new lessons. It is not the recommended new curriculum. Its Read It, Say It, Use It chapter is absent from catalog v2; speaking application is embedded in every new lesson.

The 34 original lesson IDs and configs are unchanged, including original scripted chapter introductions. Their existing in-lesson numbering/copy may refer to the old order: reconcile those introductions before shipping the newly ordered course UI. The general lesson hub ordering is unchanged; this new ordering is specific to this catalog.

## Launch and complete

Read `node.startRequest`, then use the existing `POST /sessions` API:

```json
{"sessionType":"training","lessonId":"pron_phonics_01_first_code"}
```

Continue with the existing session-turn API and lesson-result/reward flow. New lesson IDs are `pron_phonics_01_first_code` through `pron_phonics_20_oa`; use the returned IDs rather than constructing them.

No new minigame reward IDs are registered. New lessons cannot claim rewards through `/mini-games/:id/complete` or pass through `/phonics/nodes/:id/check`.

Course completion reads `userSession` training records with `rewardsApplied=true`, exactly as existing lesson completion does. The 34 old lessons keep their completion records. Unrelated lessons and old quiz passes are excluded. `currentNodeId` is the first incomplete lesson or null; navigation is recommended, not locked.

## Lesson flow

Welcome → notice the sound/spelling relationship → whole-word model → speaking attempt → repeat with another example → optional compare board → try a new printed word before tutor audio → reveal/model → speak again → modeled short phrase → say the phrase → completion.

- Existing `LessonConfig`, TTS, Continue/microphone and `emojiChoice` schema are reused.
- Choices use strings in `emoji` (for example `a_e`) and real whole words in `label`/`speak` (for example `cape`). The existing BE normalizer accepts these. FE symbol layout and tap behavior have NOT been verified or modified.
- Only previously modeled words appear on comparison boards. Either choice is an acceptable speaking practice target; no deterministic phonics score or pass threshold.
- The reserved transfer word is displayed in the card/expectedSpeech only on its first attempt, not read in tutor text. Its model and meaning follow the attempt. This is authored prompt behavior and needs live model verification, not a deterministic mastery test.
- `coachOnly=true`: a transcript cannot prove phoneme accuracy, voicing, stress, vowel quality or accent. No acoustic scores. Completion represents participation, not certified decoding skill.
- Sound-symbol inventories grow cumulatively. `x` and `qu` are explicitly not described as single sounds; `ng` and `nk` are distinguished. Silent-e changes vowel quality, not just duration. TH voicing and EA exceptions are not presented as universally predictable rules.

## Audio and release limitations

This BE implementation uses **natural whole-word TTS models**. It does NOT provide verified isolated phoneme recordings or slow joined-blending audio. It explicitly forbids treating raw IPA, underscore patterns or Thai respellings as verified sound clips. Actual highlighted-letter animation or separate phoneme playback is not implemented.

Catalog `releaseChecks` reports pending frontend rendering/live voice verification and unavailable isolated-phoneme audio. `backendReady` means the lesson config can be resolved and started, not that those release checks passed. All new content is playtest status, not production-ready phonics instruction.

Before release:

1. Play through the full new lesson flow with correct, wrong, help-request and short answers, confirming progression and no premature transfer reveal.
2. Test symbol choice rendering, speech prompts and TTS text separation on FE.
3. Produce/review consistent-accent isolated and joined-sound audio if delivering explicit sound-by-sound blending. Wire that media contract before claiming this experience is available.
4. Reconcile legacy chapter intro copy with the new display order without changing lesson IDs/progress.

## Files and tests

- `src/phonics/phonics-lessons.authoring.json`: 20 lesson specs, mappings, model words, reserved transfer, phrase and aligned support choices.
- `src/phonics/phonics-lessons.data.ts`: compiles those specs into ordinary Lesson configs.
- `src/phonics/clear-english-course.data.ts`: explicit 54-lesson ordering and progress view.
- `npm run test:phonics`: catalog, legacy compatibility, progress isolation, lesson registration and choice contracts.
- `npm test` and `npm run build`: regression suite/build.
