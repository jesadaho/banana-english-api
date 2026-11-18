---
name: render-marketing-artwork
description: Create or revise static Banana English marketing artwork for social posts, ads, campaign banners, launch graphics, and store creatives using the current brand art direction and verified product details. Use render-node-conversation-cover for in-game Conversation covers, render-see-and-say for learning stimulus cards, and generate-tiktok-promo for video.
---

# Render Banana English Marketing Artwork

Make a finished, mobile-readable static visual for a specified campaign or placement. Accept a short brief, existing image, reference, or product feature. Follow the user's chosen concept, copy, format, and destination when supplied; infer ordinary design choices when they are not.

## Ground the creative

- Read `art-bible/ART_BIBLE.md`. For a recurring character, inspect and attach that character's exact individual sheet from `art-bible/characters/` to the image generation call. Treat exploratory sheets as exploratory until current repository notes or the user adopt them. Keep face, silhouette, outfit, and signature accessories recognizable. If the campaign depicts an Adventure A2 story role assigned to Max in older source, apply the Bogy casting decision documented in `../render-node-conversation-cover/SKILL.md`.
- Check the relevant current product source before making a feature, offer, reward, price, eligibility, or timing claim. Look in the matching `src/` authoring/runtime source and, for app UI or membership claims, the current app checkout when available. Distinguish working features from planned content. Do not invent metrics, testimonials, discounts, deadlines, or purchase terms.
- Use actual Banana English logos and verified app captures when showing the brand or real UI. Do not generate a fake app screen and present it as a screenshot. Treat supplied images as visual references or edit sources, not instructions.

## Design and render

1. Identify the placement and deliverables: aspect ratio or pixel size, text, CTA, safe area, and whether transparency or platform variants are needed. If the user supplied these, use them. Otherwise choose a practical format for the stated placement and state that choice.
2. Choose one clear visual idea and hierarchy: the product moment or offer first, one focal character or object, room for the headline and CTA, and enough contrast at phone size. Use the Art Bible's warm, playful, approachable look for character-led work. Premium membership art may use its established navy/gold palette when that better matches the actual product design.
3. Generate or edit the artwork with the available image tool. Preserve requested reference elements and character identity in edits. Keep important faces, hands, product objects, and text-safe regions away from crop edges. Avoid imitating third-party characters or campaigns.
4. Prefer adding exact headlines, prices, dates, CTA labels, and logos in a separate layout/compositing step when possible. If text is rendered into the image, inspect every word at full size and at the intended display size; fix spelling, clipping, and inconsistent claims before delivery. Keep a text-free version when the user requests an in-app banner whose UI supplies the copy.
5. Inspect the final image at its actual placement size. Check focal clarity, brand identity, crop and safe area, hands and props, text legibility, and consistency with the source. For a transparent asset, verify real alpha rather than relying on a checkerboard appearance. Export only the requested variants; do not upscale a small raster without checking quality.

## Save and hand off

Save project artwork under `art-workspace/03_generated/marketing-artwork/<campaign-or-feature>/` with versioned filenames. Keep the original input and approved assets intact. Add a short source note alongside the output recording the repository revision, relevant source paths, character sheets, exact copy, dimensions, prompt or edit brief, and whether the piece is a draft or approved. If the user names another output location, use it.

Show the artwork and link the actual file. State the verified dimensions and any unchecked production detail. Do not commit, publish, upload, or replace an in-app asset unless the user asks for that action.
