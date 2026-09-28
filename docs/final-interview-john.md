# Final Interview with Teacher John (V7 finale: intro + 16 scored questions)

Scenario id: `final_interview_john` · path node `v7_finale_n01` (16.13)
Source: `src/interactive-scenario/interactive-scenario.data.ts`

## Flow
- Beat 1 "Are you ready?" is ungraded (any reply continues). Then 16 scored beats, one question each, covering ch.1–16 (see `measuresChapters`). Opening = beat 1 ("Finally… you made it to the top… Are you ready?").
- Correct → praise (+ `{name}` / `{city}` when captured) + next question.
- Assessment = one try per question (`maxAttemptsPerBeat: 1`).
- Close (AI) → pass + recast of the learner's own sentence: "Good! We say: I wake up at six." (sub: เกือบถูกแล้ว! พูดว่า …)
- Wrong → reveal + move on: "You can say: <model>. Next!" (sub: เฉลย: “…”) — goal stays unchecked (`goalOutcomes = skipped`).
- Noise ("", "uh", "zzz"…) is wrong without an AI call.
- Matching: local regex/examples first; if no match, Gemini `evaluateScenarioUtterance` (6 s timeout) → correct / close / incorrect. `close` passes.
- Beat 14 (ask John): John answers the learner's question first (`answerLearnerQuestion`).
- Scenario ends after beat 16 even with skipped goals; rewards use checkpoints / 16.

## Turns
| # | John asks | Goal | Chapter |
|---|-----------|------|------|
| 1 | …Are you ready? | — (ungraded) | — |
| 2 | What is your name? | name | 1 |
| 3 | Where are you from? | from_live | 1 |
| 4 | How old are you? | age | 3, 8 |
| 5 | Tell me about one person in your family. | family | 4 |
| 6 | My bag is blue. Is this my bag? | this_that | 6 |
| 7 | And what do you have in your bag? | have | 7 |
| 8 | How many apples are there? | plural | 5 |
| 9 | What time do you wake up? | wake_time | 9 |
| 10 | Tell me about May's day. | her_day | 12 |
| 11 | What is Max doing now? | happening_now | 13 |
| 12 | Do you like coffee or tea? | like | 10 |
| 13 | Can you swim? | can | 11 |
| 14 | ⭐ Ask me a question! | ask_back | 14 |
| 15 | ⭐ Ask me the price (red shirt). | ask_price | 15 |
| 16 | ⭐ Where is Room 2? | directions | 16 |
| 17 | Time to say goodbye! | goodbye | 2 |

Cards (`emojiChoice`) appear only as picture stand-ins on turns 6, 8, 10, 11, 15, 16 — never as answer options on personal questions. Labels give facts from the picture, not the target words. No flag emoji (they don't render on web).

## Images to produce (then set `imageAsset` on the beat → app switches to `focus_image`)
Put files in the app under `assets/images/learn/scenario/`:
- t05 `final_interview_bags.jpg` — red bag near, blue bag far
- t07 `final_interview_apples.jpg` — three apples on a table
- t09 `final_interview_mia_day.jpg` — timeline 7:00 wake up → 8:00 work
- t10 `final_interview_max_eating.jpg` — Max eating now
- t14 `final_interview_shirts.jpg` — red shirt (price hidden) / blue shirt 80 ฿
- t15 `final_interview_map.jpg` — map: straight, then left to Room 2
Until then every beat uses `beside_teacher` + `emojiChoice` cards.

## TTS
Start response returns `scenario.ttsVoiceProfile = "teacher_john"`.
`POST /api/tts/synthesize(-stream)` accepts optional `voiceProfile` (`teacher_b` | `teacher_john`).
`teacher_john` = Gemini voice `Iapetus` (override with env `GEMINI_TTS_VOICE_JOHN`), native-English style prompt.
App: mobile already uses Iapetus; web "server" TTS mode should send `voiceProfile` (app change, not done).
