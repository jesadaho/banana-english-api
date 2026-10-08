---
name: generate-tiktok-promo
description: Create Banana English TikTok promotional videos grounded in repository product content and exact character sheets. Use for TikTok ads, short promotional clips, teasers or social video campaigns; prepare a Thai concept and storyboard first, then generate approved vertical clips with Veo API and verify Thai speech.
---

# Generate a TikTok Promo

Create a 20–30 second vertical Banana English promo with a clear hook, a concrete learning moment and one call to action. Use Thai speech by default, with short English learning examples. This is a campaign workflow; do not inherit the English-only speech rule from Conversation cutscenes.

## Sources and identity

Use `jesadaho/banana-english-api`, the active checkout or connected GitHub tools, on the requested branch or default branch. Record the source revision. Discover actual paths with `rg` or repository tree listings.

Read `../render-node-conversation-cover/SKILL.md`, `art-bible/ART_BIBLE.md`, the relevant `src/learn-path/*-path.catalog.json` and matching `src/simulations/*-simulations.authoring.json`. For other features inspect their actual authoring/runtime source. Distinguish planned content from working product behavior. Do not invent prices, download links, learning results, testimonials or app screens. Use an actual verified screen capture for UI demos, composited in editing; never present generated UI as the real app.

Always choose cast from `art-bible/characters/` before designing shots. Materialize, inspect and attach the exact individual sheet for every shown recurring character when generating keyframes. Apply the cover skill's A2 Max → Bogy override. Preserve face, proportions, hair, outfit and accessories. Resolve exploratory status using repository declarations and explicit user adoption. Do not use a sheet grid as a video starting frame. Do not substitute old generated artwork or a textual character description for an attached sheet.

Use stylized 3D characters with a believable, softly detailed Thai environment and natural light. Keep scenery subordinate and essential props legible. Follow current Art Bible and explicit campaign art direction.

## Concept before rendering

Send a Thai text proposal before generating keyframes or submitting paid jobs. Include:

- Objective, intended viewer, source-grounded feature and exact cast.
- Hook, story beats and one CTA; use a generic CTA if no verified destination is supplied.
- A shot table: shot ID, generated duration, final edit duration, action/camera, exact Thai/English speech, overlay/subtitle text and sound.
- Target 9:16, 720 × 1280 delivery, 20–30 seconds, provider/model and estimated cost.
- A short Thai speech test using the actual first speaking shot, with any budget reserved for alternatives.

Default structure: hook in the first 2 seconds, relatable problem, one vivid learning demonstration, payoff and CTA. Avoid overloading one shot with several actions or speakers. Keep speech short enough to finish naturally within each shot. Place overlay text away from faces and TikTok controls; add exact text in editing rather than relying on generated lettering.

Obtain explicit approval of this concrete storyboard before rendering. Reuse approval already given for that storyboard and budget; do not ask repeatedly. A request to create this skill is not authorization to render an unspecified campaign.

## Veo provider

Default to Gemini API Veo 3.1 Lite, `veo-3.1-lite-generate-preview`, 720p, 9:16, native audio. Use `veo-3.1-fast-generate-preview` for approved shots that need an alternative. Do not silently switch to MiniMax or a more expensive tier.

Before each campaign verify current official model availability, supported durations, image inputs, parameters and pricing:
- https://ai.google.dev/gemini-api/docs/veo
- https://ai.google.dev/gemini-api/docs/pricing

As checked on 2026-10-08, Lite supports initial/last image inputs but not referenceImages or video extension. Generate sheet-grounded single-scene keyframes with the image tool, then use those as image-to-video inputs. Build longer promos by editing short independent shots. Do not assume features or resolutions are shared across model variants.

For budget orientation only, the checked 720p audio-inclusive rates were Lite USD 0.05/generated second and Fast USD 0.10/generated second. Recheck before quoting. Estimate all submitted duration, including the test and unused handles, rather than only final timeline length. List image generation, editing or other costs separately when applicable. Count a retained test shot once; record billed cost only when known.

Use an available authorized `GEMINI_API_KEY` environment variable or secure credential facility. Never write credentials to Git, metadata, prompts or logs. If unavailable, finish the storyboard/keyframe plan and report the credential requirement without pretending to submit jobs.

Use the current official Google Gen AI SDK's video generation and operation polling APIs, or the verified REST equivalent. Verify the request schema for the selected model before submission. Persist the returned operation name immediately. Poll in bounded intervals with progress updates; after timeout resume the same operation, never blindly resubmit. Record sanitized failure details. Download completed videos promptly and inspect them before accepting a shot.

## Thai speech test and rendering

1. Generate and inspect the approved speaking keyframe with exact character sheets attached.
2. Submit only the approved short speaking shot first. Specify the speaker, exact quoted Thai line, emotion, natural Thai pronunciation, sound ambience and restrained music. Keep English examples explicit and do not substitute transliteration for the Thai script.
3. Listen to the actual audio. Check exact words, Thai pronunciation, natural pacing, voice fit and lip sync. Inspect character identity and motion. Do not infer audio quality from the prompt or a transcript alone.
4. If it passes, retain it as a final shot and continue the remaining approved shots. If it fails, try only alternatives already covered by the approved budget. Otherwise present the failed sample and a concrete revision before further paid jobs. Do not assume Fast guarantees better Thai.
5. Keep a stable voice description, cast and visual direction across prompts. Verify voice continuity across shots; native audio does not guarantee identical voices. Offer a separate Thai voiceover only if needed and approved, with its additional cost disclosed.
6. Make each shot a coherent action with restrained camera motion. Carry continuity through keyframes, props, eyelines and light. Keep dialogue free of cut points; use edit handles for transitions.

## Assemble and verify

Edit to one actual MP4, H.264 video with AAC audio, 9:16 target 720 × 1280. Avoid stretching. Trim generated handles and pauses to the approved timeline. Add accurate Thai/English subtitles, verified brand assets and CTA during editing. Duck any licensed or otherwise authorized music under speech. Export a clean version and captioned version when requested.

Use ffprobe to verify actual dimensions, duration, codecs and audio stream. Inspect frames across every shot and transition. Watch motion and listen to the entire assembled clip: no identity drift, duplicate limbs, wrong words, clipped dialogue, abrupt voices or obscured captions. If playback or audio inspection is unavailable, disclose the unchecked gate and mark the result as requiring review. A slideshow of keyframes is not a completed generated video.

## Files and delivery

Save versioned project assets under `art-workspace/03_generated/tiktok-promos/<campaign-slug>/`:
- `concept.md` with approved storyboard and exact script.
- `keyframes/`, `shots/`, and versioned final MP4.
- Subtitle file when captions are produced.
- `metadata.json` with schema version, campaign ID, repository/revision, source paths/IDs, cast and sheet paths/status, approval scope, exact prompts, per-shot model/settings/operation name, generated versus used duration, test result, costs estimated/known, final technical properties and QA status.

Persist job state as soon as submitted so interrupted runs resume safely. Exclude keys and signed download URLs. Use available project storage; do not claim saved or committed assets until verified. Commit/upload media only when the user requests it. Never overwrite character sheets or approved assets. Mark output Generated — review required until explicitly approved.

Return the playable clip, actual duration/dimensions and concise review notes. Do not publish to TikTok automatically.
