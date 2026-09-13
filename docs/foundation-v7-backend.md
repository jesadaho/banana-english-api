# Foundation V7 — backend playtest handoff

Backend-only implementation of the approved 16-chapter, 107-node V7 roadmap.
No frontend changes, database migration, deployment, or change to the V2/V5/V6 endpoints.
This is a playtest release: automated contract tests pass, but the newly authored AI lessons/conversations still need live voice playtesting.

## Read the path

- `GET /learn-path/foundation-v7` with the existing authenticated/anonymous-user headers.
- Only a client that implements Guided Say It should send `?capabilities=say_it_guided`.
- Unknown capabilities return HTTP 400.
- Default: 87 playable nodes. Guided-capable client: 90 playable nodes.
- `summary.nodeCount` is always 107. `progress.totalCount` counts only currently playable nodes, not placeholders.
- `backendReady` describes backend content availability, not frontend or live-AI validation.
- `comingSoon`, `unavailableReason`, and `requiredClientCapabilities` must be honored.
- `progress.currentNodeId` is one node or null. Completed canonical content is reused across paths.
- Placeholders are visible but never prerequisites that block the remaining playable content.

## Content

- Lesson: 39 nodes, including the 3 frozen Chapter 1 lessons and 36 new V7-authored configs.
- Say It: 18 nodes, including the frozen Chapter 1 pack and 17 new five-question pools.
- Emoji Speak: 13 new pools with 4–5 cards each.
- Pronunciation: 4 existing lessons, referenced directly without rewriting their sound targets: `pron_th_2`, `pron_end_t_1`, `pron_final_s_1`, `pron_stress_1`.
- Conversation: 16 nodes, including the frozen Chapter 1 simulation and 15 new scenarios.
- Describe It: 13 Coming Soon nodes. Story Bites: 4 Coming Soon nodes. No substitute game is silently launched.
- No Skill Mix, Skill Check or Sentence Builder nodes. Guided is a Say It mode, not a new game engine.

New lessons/scenarios are resolved by their exact IDs. They are not inserted into the legacy lesson/mission hub ordering or Daily Mission rotation.

## Start and complete

Use the returned `lessonId`, `simulationId`, `topicId` or `poolId`, not the path node ID, when starting an activity.

- Lesson/Pronunciation: existing training session API and lesson completion/reward flow. V7 lessons opt into the existing listen-only/Continue contract.
- Conversation: existing simulation session API and reward flow. At the turn cap, incomplete goals stay incomplete and the closing copy stays neutral; existing practice completion semantics remain unchanged.
- Say It: existing `/say-it/topics/:topicId/start`, `/deal`, `/complete` routes. Foundation start remains free, with five dealt questions.
- Emoji Speak: existing `/mini-games/emoji-speak/:poolId/start` and `/deal` routes. Foundation start retains the existing 1-banana cost. Complete via `POST /mini-games/:gameId/complete`.
- Mini-game completion accepts catalogued path node, topic/pool, or prefixed ID aliases. All aliases normalize to `say_it:<topicId>` or `emoji_speak:<poolId>` before recording rewards.
- Prior aliases, including the frozen Chapter 1 V2 ID, are checked to avoid paying the same activity again through a different route. This does not add a new server-verified scoring engine or change the existing transaction-concurrency guarantees.
- Lesson, simulation, Describe It, Story Bites and unknown V7 IDs cannot claim mini-game rewards.

Guided packs `fnd_v7_u03n04`, `fnd_v7_u07n06`, `fnd_v7_u12n06` preserve authored question order: first three expose `mode: guided`, `hintEn`, and three full-sentence `choices`; final two omit assistance. The learner still speaks the answer. Unsupported clients see these three nodes as Coming Soon.

## Authoring sources

- `src/learn-path/foundation-v7-path.catalog.json`: sequence, types, learning targets, difficulty axes, exact content references.
- `src/lessons/foundation-v7-lessons.authoring.json`: model/practice blocks and transfer prompts.
- `src/say-it/foundation-v7-pools.json` and `src/emoji-speak/foundation-v7-pools.json`: new pools using the existing schemas.
- `src/simulations/foundation-v7-simulations.authoring.json`: learner-visible context, NPC facts, goals and turn caps.
- `src/learn-path/foundation-v7-media.authoring.json`: server-only clip scripts/questions/answer evidence and image briefs. These are not returned by the path endpoint; no media generation or media-game implementation is included.

## Verification

Run `npm run test:foundation-v7`, `npm test`, and `npm run build`.
V7 tests cover catalog counts, exact references, frozen content, real pool deals, Guided order, placeholder/capability behavior, progress/current-node resolution, reward alias deduplication, route acceptance/rejection and neutral conversation closure.

Before release, play through the new AI lessons and conversations with correct, wrong, short and off-topic speech. Test Guided rendering with a capable frontend. Automated config/contract tests do not validate live model behavior, audio quality, or educational effectiveness.
