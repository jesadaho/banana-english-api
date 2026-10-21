---
name: render-storybook
description: Create Banana English illustrated children's storybooks from a page-by-page manuscript using the Git Art Bible and exact attached character-sheet PNGs. Use for storybook concepts, page layouts, Meet the Characters pages, and production illustrations.
---

# Render Banana English Storybooks

Create a coherent illustrated children's storybook, not a collage of invented characters or an app worksheet. Story comes first; optional AI speaking practice is placed at the end.

## Source of truth and execution environment

Repository: `jesadaho/banana-english-api`. Prefer an active local checkout (including `/Users/jesada/Project/banana-english-api`) with direct filesystem access. Otherwise use connected GitHub tools to read text and an authenticated binary download route to materialize PNG files. Pin a revision when possible. Read on every run:

- `art-bible/ART_BIBLE.md`
- `art-bible/characters/<exact-name>.png` for **every** character appearing
- `.agents/skills/render-see-and-say/SKILL.md` for art continuity and image QA
- `.agents/skills/render-node-conversation-cover/SKILL.md` for binary materialization and character identity rules

A skill file alone does **not** grant repository filesystem access or make binary GitHub connector responses available. Never assume access merely because text files can be read.

## Mandatory character-reference gate — STOP on failure

1. List the current Git `art-bible/characters/` directory and identify the exact cast. Typical paths: `teacherB.png`, `may.png`, `bogy.png`, plus any additional on-page cast.
2. Download/materialize the actual PNG bytes from the pinned Git revision. Local checkout is preferred; a verified authenticated Git/raw download is acceptable. GitHub URLs, filenames, markdown descriptions, generated images, and empty base64 connector responses are **not** reference images.
3. Verify each file exists, is a decodable image rather than an LFS pointer, and inspect it visually.
4. Attach the **actual image bytes/files** to the image-generation tool using its supported reference-input mechanism. Verify the tool can consume each attachment.
5. If any reference cannot be obtained, opened, or attached, **do not generate**. Report the exact failed step and what access route is needed. Do not substitute prose descriptions or invent lookalikes. Do not claim character-accurate rendering without verified attachment.

Preserve approved face, silhouette, hairstyle, outfit, palette, proportions and accessories. Do not redraw Teacher B as a generic banana, Minion, or bottle shape. A2 casting rule Max → Bogy applies only where relevant; do not automatically alter unrelated storybook casts.

## Story and page plan

Start with a compact page-by-page outline and approved cast. For a 16-page concept, confirm whether the 16 pages include the cover and back cover; for print production, distinguish interior page count from covers and printer signatures. If the user has already approved a specific outline, follow it without asking again.

Default first-book concept when requested: **The Missing Banana**, beginner A1 English, Teacher B / May / Bogy, gentle mystery about missing picnic bananas. Include a one-page **Meet the Characters** introduction after the cover or at the start of the interior. Keep each page's English simple and readable aloud, generally 1–4 short sentences. Build a satisfying narrative with consistent clues and resolution. Reserve the last pages for optional **Think & Speak** comprehension prompts and a **Talk with Teacher B** QR/deep link; do not fabricate a working QR destination.

## Visual style and layout

Follow the current Art Bible: compact expressive stylized 3D game characters in believable semi-realistic Thai everyday environments, warm cinematic natural light, soft matte/painterly surfaces, consistent camera and color grade. The FIRST Bogy-running See & Say image is a background mood reference only, **never** a replacement for individual character sheets. No spherical-tree minimalist cartoon world, photoreal human models, glossy plastic, unrelated IP, or arbitrary NPCs.

Prefer **one full-size illustrated page or one spread at a time**, not a 16-thumbnail collage. Preserve character continuity and setting across pages. Design text-safe negative space; typeset final English text deterministically outside the image generator where possible. Check spelling and mobile/print legibility. Use exact dimensions and bleed only after establishing the intended print trim, printer requirements, and whether the image is a single page or spread. Never assert print-ready without checking bleed, DPI, safe margins and exports.

For **Meet the Characters**, use actual cast sheets and short A1 descriptions. Do not generate generic placeholder faces and call them canonical.

## Workflow

1. Read source Art Bible, related skills, and page/story requirements.
2. Resolve cast and pass the mandatory binary reference gate **before rendering any page**.
3. Present a short Thai storyboard/page plan if not already approved; if user explicitly asks to render now, proceed after all gates pass.
4. Render **one proof page first** (normally Meet the Characters or a representative story spread) using the actual attached reference PNGs.
5. Compare each output against every character sheet and page-specific story facts. Reject identity drift, missing/extra characters, anatomy errors, wrong props, inconsistent clues, unreadable text and crop failures.
6. Continue remaining pages only after approval or an explicit batch instruction. Version assets; never overwrite approved references.
7. Save PNG masters and, when requested, print PDF or export WebP. Keep a source note: Git revision, attached reference paths, manuscript/page, prompt, dimensions, QA and review status. Store generated work under `art-workspace/03_generated/storybooks/<book-slug>/` when working in the project.
8. Deliver only actually generated/verified artifacts. Label drafts **Generated — review required**. Never auto-commit art, upload to Firebase/Drive, or publish without instruction.

## Proof-page prompt structure

> Banana English illustrated storybook, [book title], page [number], [single-page/spread aspect ratio]. Use the **attached exact Git character sheets** as identity locks for [cast]. Follow current Git Art Bible. Warm cinematic stylized 3D characters in a believable semi-realistic Thai environment, matte painterly materials and coherent daylight. Show [specific narrative action and emotional beat], with [essential clues/props], [composition and text-safe space]. Preserve all reference outfits, faces, proportions and accessories. No invented characters, no lookalikes, no unintended text, no logos or watermarks.

If actual character PNG attachments are unavailable, stop before invoking image generation.
