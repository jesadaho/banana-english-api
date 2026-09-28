# Final Interview with Teacher John (V7 finale, 16 turns = 1 per chapter)

Scenario id: `final_interview_john` · path node `v7_finale_n01` (16.13)
Source: `src/interactive-scenario/interactive-scenario.data.ts`

## Flow
- 16 beats, one goal each, one per Foundation chapter (see `measuresChapters`). Opening = beat 1 ("Finally… you made it to the top… Are you ready?").
- Correct → praise (+ `{name}` / `{city}` when captured) + next question.
- Assessment = one try per question (`maxAttemptsPerBeat: 1`).
- Close (AI) → pass + recast of the learner's own sentence: "Good! We say: I wake up at six." (sub: เกือบถูกแล้ว! พูดว่า …)
- Wrong → reveal + move on: "Nice try! You can say: <model>. OK, next one!" (sub: เฉลย: “…”) — goal stays unchecked (`goalOutcomes = skipped`).
- Noise ("", "uh", "zzz"…) is wrong without an AI call.
- Matching: local regex/examples first; if no match, Gemini `evaluateScenarioUtterance` (6 s timeout) → correct / close / incorrect. `close` passes.
- Beat 14 (ask John): John answers the learner's question first (`answerLearnerQuestion`).
- Scenario ends after beat 16 even with skipped goals; rewards use checkpoints / 16.

## Turns
| # | Goal | Chapter |
|---|------|------|
| 1 | ready — "Are you ready?" | 3 |
| 2 | name — name + where from | 1 |
| 3 | age | 8 |
| 4 | family | 4 |
| 5 | this_that (red/blue bag) | 6 |
| 6 | have | 7 |
| 7 | plural (three apples) | 5 |
| 8 | wake_time | 9 |
| 9 | her_day (Mia timeline, she + -s) | 12 |
| 10 | happening_now (Max eating) | 13 |
| 11 | like (coffee/tea) | 10 |
| 12 | can | 11 |
| 13 | ask_back ⭐ | 14 |
| 14 | ask_price ⭐ (red shirt, 50 ฿) | 15 |
| 15 | directions ⭐ (straight + left) | 16 |
| 16 | goodbye | 2 |

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
