---
name: generate-conversation-cutscene
description: Create Banana English pre-conversation cutscene clips with MiniMax from a Conversation Node ID or course/chapter. Read Git simulation sources and character sheets, prepare keyframes and motion prompts, generate and verify video when MiniMax access is available, or deliver a clearly labeled generation package when it is unavailable.
---

# Generate a Conversation Cutscene

Create a 15–30 second story sequence that places the learner in the situation immediately before the Conversation Stage. Use MiniMax as the default video provider. Follow explicit user choices over defaults.

## Resolve source and identity

Use `jesadaho/banana-english-api`, its active local checkout or connected GitHub tools. Use the default branch unless the user specifies another branch. Record the revision; pin reads to that revision where supported.

Read the current sibling skill `../render-node-conversation-cover/SKILL.md` for repository discovery, Node resolution, binary-reference handling and current casting decisions. Apply its source and identity rules, but do not inherit its cover dimensions or image-only output workflow.

Read:
- `src/learn-path/*-path.catalog.json`: Node, chapter, type and `contentRef.simulationId`.
- `src/simulations/*-simulations.authoring.json`: complete matching simulation including scenario, role, opening, goals, completion and turn range.
- `art-bible/ART_BIBLE.md` and relevant existing Git identity documents.
- Exact individual sheets in `art-bible/characters/` for every recurring character shown.

Use local `rg` excluding node_modules/dist or fetch exact Git paths. Empty indexed search does not establish absence. Do not use stale conversation summaries or Google Drive as source substitutes.

Resolve one requested Conversation; ask for a selection only if multiple match and the user intent cannot distinguish them. Resolve interactive scenario aliases/loaders when source type differs; report the actual source type. Never invent missing story content from a chapter title.

Apply the current A2 Max → Bogy casting rule from the sibling skill. Preserve source learning goals and record the substitution. Respect explicit user cast overrides. Never silently rewrite course data.

Materialize exact Git sheets, detect LFS pointers, inspect images, and attach the actual files through the image/video tool's supported mechanism. A URL or prose description alone is not an attached identity reference. For a composed first frame, use the sheets to create that frame; distinguish sheets attached to image generation from frames attached to video generation in the log. Check identity approval against current Git declarations and user authorization; do not infer approval from file existence. Stop character rendering if mandatory sheet bytes cannot be consumed, while still preparing the grounded storyboard.

## Defaults

Treat these as production targets, not claims about provider capabilities:
- Total duration per Conversation: 15–30 seconds. Plan several short shots whose approved durations add up to that range. Choose provider-supported per-shot durations; never silently change the approved total.
- Format: 9:16 portrait, target 720 × 1280. Use an explicit app viewport requirement when provided. Do not assume Conversation Stage dimensions are known or copy the 2:1 cover ratio.
- Structure: a short multi-shot sequence; keep each generated shot continuous, with one main action and at most one restrained camera movement.
- Cast: only characters needed by the scenario; normally one or two.
- Audio: silent by default, with no visible talking or lip-sync. Add dialogue, ambience or music only when requested.
- Artwork: warm stylized 3D, exact sheet proportions, matte materials, simplified Thai everyday environment with one location cue and essential props.
- No generated title, subtitle, logo, UI, border or watermark. Do not erase provider watermarks; report and use a permitted clean export when available.
- Keep important faces, hands and props in the central 80%; leave calm top/bottom space for app overlays.
- Finish with a stable 0.5–1 second conversational pose where feasible.

## Direct the story

Extract location, partner, learner role, immediate objective, emotional beat, props, opening line and cast constraints from the actual simulation. Use the simulation over conflicting catalog prose.

Write a concise Thai concept and a shot-by-shot storyboard table: shot number, start/end time, duration, visible action, camera/framing, emotion, audio and transition/continuity. Include total duration and the exact stage handoff. Use an adaptable three-beat structure:
1. Establish the actual situation.
2. Show the small event that creates a reason to speak.
3. Turn attention toward the learner, ready for the stage's existing opening.

Keep the challenge unresolved. Do not perform the learner's task, answer the question, spoil the outcome, or introduce a new goal. Do not repeat `openingEn` as cutscene dialogue by default. Record that line as the stage handoff; preserve its exact text and state whether playback belongs to the stage or the clip.

Avoid unnecessary locations, complex crowds, fast orbiting cameras, multiple simultaneous actions, face morphing, teleporting props and wardrobe changes. Give Teacher B naturally aligned pupils, connected eyelines and an approachable expression; use a broad smile when appropriate to the scenario. Preserve every character's distinct identity rather than imposing Teacher B's acting on all cast.

## Mandatory storyboard approval

Follow the user's required order:
1. Read the Conversation's actual scenario and concept.
2. Study the current Art Bible and inspect the exact artwork/character sheets.
3. Present a source-grounded storyboard for a total of 15–30 seconds.
4. Wait for the user's explicit approval of that storyboard before generating production keyframes, submitting MiniMax jobs or creating the final video.

The initial response must deliver the storyboard for approval, not just a proposed process. Include a concise Thai concept, source Node/simulation/revision, cast/reference status, shot table, total runtime, any spoken lines, and how the final shot enters the stage. A text storyboard is sufficient unless visual panels are requested. Do not make live paid video calls to test the storyboard.

Treat feedback as storyboard revision; present the revised affected shots and updated total. Approval applies to the accepted storyboard/version. Reuse explicit approval already given for that exact version; do not repeatedly ask. Seek renewed approval for material changes to plot, cast, dialogue or runtime. Routine technical corrections that preserve the approved plan do not require another approval. If the user explicitly asks for storyboard only, stop after delivering it.

## Prepare frames and MiniMax prompt

Prefer image-to-video from a composed first frame grounded in the Git sheets. Use a last frame or reference images only if supported by the selected MiniMax model and route. Do not animate a character-sheet grid as the scene.

Reuse a user-selected scene image only after checking its identity, setting, cast, format and compatibility with this simulation. Otherwise generate one first frame with the available image-generation workflow and exact sheets. Prepare an optional end frame only when continuity control needs it; match cast, clothing, light, lens, set and prop positions.

Write an English motion prompt describing actions in time order. State exact cast, initial pose, one action, restrained camera movement, intended final pose, steady identity and scene continuity. For image-to-video emphasize motion rather than redescribing or redesigning the frame.

Use this structure, replacing every bracket:
> Animate the supplied first frame as a single continuous [duration]-second Banana English pre-conversation scene. Exact cast: [names/count]. Preserve their faces, silhouettes, proportions, clothing, accessories and the scene's lighting. At the start, [pose/situation]. Then [one concrete action with believable physical motion]. Finally [attention toward learner and stable handoff pose]. Camera: [locked shot or one subtle movement]. [Audio instruction]. Maintain coherent eyes, hands and props, a calm minimal background and readable mobile framing. No scene cut, new character, identity change, text or UI.

Include constraints in the main prompt if the route has no separate negative-prompt field. Do not invent syntax or send unsupported fields.

## Run MiniMax or deliver a generation package

Check available tools/authorized API access without printing credentials. Prefer a supported MiniMax connector or API. Do not fall back to another provider without user instruction.

Consult current official documentation before selecting a model or preparing executable requests:
- https://platform.minimax.io/docs/guides/video-generation
- Follow its current API reference for the selected model and route.

Verify model name, endpoint, duration, resolution, input limits, image transport, audio controls, task statuses and download flow. API versions and capability sets differ; never mix an older Hailuo request schema with a newer model. Record documentation check date and chosen settings. Adapt unsupported output sizes without stretching and disclose verified delivered dimensions.

Read `MINIMAX_API_KEY`, `MINIMAX_API_HOST`, and `MINIMAX_SUBSCRIBTION_KEY` from `minimax.credentials` in this skill folder. Do not print the keys. Do not request a secret pasted into chat. Use supported authenticated uploads or accepted local/base64 input where available; do not expose private Git assets at an invented public URL.

For asynchronous jobs, save the returned task ID immediately, poll using documented limits and bounded timeout, and resume an existing task rather than submitting duplicates. Report provider failures accurately. Do not launch paid retry loops; one approved sequence is the default scope; submit only its approved shots.

When access or credentials are missing, still complete a useful package: grounded Thai concept, timing table, actual reference manifest, keyframes when image tools can consume the references, English MiniMax prompt, proposed model/settings with verification status, and the blocker. Label it **Prepared — video not generated**. Never call a still, storyboard or camera-pan slideshow an AI-generated video.

## Verify and save

Generate each approved shot separately where required by provider duration limits. Preserve reference identity, lighting, wardrobe, camera axis and prop positions across shots. Assemble in approved order with restrained cuts and any approved audio; do not imply provider-native 15–30 second support without checking it. Download the actual generated clips and assemble the final sequence before claiming success. Probe codec, dimensions, duration, frame rate and audio; inspect start, middle and end frames, plus samples around the principal motion. Play the clip when supported. If motion/audio playback cannot be reviewed, disclose that limit.

Check character stability, pupil alignment, limbs, eyelines, prop continuity, uncluttered background, mobile readability, absence of unrequested speech/text, unresolved learner task and a clean stage handoff. Correct defects within authorized scope; retain failed drafts without calling them approved.

Use versioned files under `art-workspace/03_generated/conversation-cutscenes/` for project-bound deliverables:
- `node-[id]-cutscene-v01.mp4` when generated.
- `node-[id]-cutscene-v01-first-frame.png` and optional last frame.
- `node-[id]-cutscene-v01-source.md` with repository/revision, Node/simulation, actual source type, scenario summary, stage opening, cast substitutions, identity status, reference paths and attachment roles, storyboard, exact prompt, provider/model/settings, task ID, documentation check date, verified media properties and QA limits.

Mark generated work **Generated — review required**. Preserve approved artwork. Follow the environment's artifact persistence workflow for deliverables; do not auto-commit generated media, upload to Drive, or modify application playback code unless requested. Reuse the repository's established large-media policy before a requested media commit.

Return the clip or prepared package with a brief Thai explanation: Node, story moment, actual duration/format, handoff and any real blocker. Claim only generation, attachments, verification and saved paths that actually succeeded.
