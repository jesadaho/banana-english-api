# Adventure A2 — แผนงานสำหรับ Dev (Implementation Plan)

> **สถานะ:** ออกแบบเสร็จและผ่าน QA แล้ว (`qa.py` → 0 errors) · พร้อม implement
> **อัปเดต:** 3 ต.ค. 2026 (รอบ 3: new_words สอนรากศัพท์ + lesson flow มีคำถามเช็กความเข้าใจ)
> **ไฟล์ที่ใช้คู่กัน:** `adventure-a2-package.zip`
> **ดูเนื้อหาทุกโหนดได้ที่หน้า Node List:** https://claude.ai/artifact/A32gU6giYyQBzuTSkU2iPi

---

## 1. สรุปสั้น

- Adventure A2 ต่อจาก Foundation A1 V7 มี **32 บท 328 โหนด** แบ่งเป็น **4 โซน** โซนละ 8 บท
- บทละ 8–11 โหนด โหนดละประมาณ 3 นาที เท่ากับบทละ ~30 นาที รวมทั้งคอร์สราว 16 ชั่วโมง
- เนื้อเรื่องเป็นการเดินทางต่อเนื่องเรื่องเดียว มีครูส่งไม้ต่อกันแบบเกม: **ครูบี → Nina (ท้ายบท 8) → Torto (ท้ายบท 16)**
- ชนิดโหนดใหม่ที่ต้องทำในแอปคือ `hear_it` (ชื่อบนจอ: Listen Up) และ `explain_it` ส่วน `see_and_say` และ `story_bites` ต้องปรับตามสเปกในข้อ 5
- **จังหวะแบบ A1 V7:** วัตถุดิบ → ประกอบ → ฝึก คือ new_words (**รากศัพท์** noun / verb 3–4 คำ เช่น cook, swim) → lesson ที่ใช้คำชุดนั้นแต่งประโยค และสอนการเติม -ing / -ed ในบทเรียน (cook → cooking = การทำอาหาร) → emoji_speak หรือ say_it ทวน · วลีและรูปไวยากรณ์อยู่ใน lesson ทั้งหมด
- **More Words:** new_words ที่วางหลัง lesson เพื่อเพิ่มคำที่ใช้กับรูปประโยคเดิมได้ มี 10 จุด
- **lesson ทุกบท (71 บท) มี flow แบบ V7 legacy flow:** สอนทีละน้อย → **ถามเช็กความเข้าใจ (recognition) ทุก 1–2 ขั้น** → ใช้กับตัวเอง รวม 663 ขั้น มีคำถามเช็กความเข้าใจ 221 ข้อ
- คำถามใน pool มี **594 ข้อใน 107 โหนด** ทุกข้อผ่านด่านตรวจคำศัพท์และ QA แล้ว

---

## 2. ไฟล์ในแพ็กเกจ (`adventure-a2-package.zip`)

| ไฟล์ | ใช้ทำอะไร |
|---|---|
| `adventure-a2-course.json` | **source of truth** ของทุกโหนด pool เรื่องย่อแต่ละบท และตัวละคร |
| `qa.py` | QA ทั้งหมด 9 หมวด รัน `python3 qa.py` แล้วต้องได้ `ERRORS: 0` |
| `vocabgate.py` | ด่านตรวจคำศัพท์ (qa.py เรียกใช้อยู่แล้ว) |
| `a1words.txt` | คำที่ A1 V7 สอนแล้ว ด่านคำศัพท์ใช้ไฟล์นี้ |
| `cast_brief.md` | กฎตัวละคร: รูปร่างหน้าตา สรรพนาม และบทที่ปรากฏ |
| `qa-report.txt` | ผล QA ล่าสุด |

---

## 3. ภาพรวมคอร์ส

| โซน | บท | ธีม | ครูนำ | จบโซนด้วย |
|---|---|---|---|---|
| 1 | 1–8 | ชีวิตในชมรม | ครูบี + Capy | Mission ตลาดนัดกลางคืน (8.9) → คลิปเปิดตัว Nina (8.10) |
| 2 | 9–16 | ตะลุยเมือง | Teacher Nina | Mission ตลาดน้ำ (16.10) → คลิปเปิดตัว Torto (16.11) |
| 3 | 17–24 | ทริปต่างประเทศ | Teacher Torto | Mission เที่ยวบินดีเลย์ (24.8) → คลิปความลับของ Max (24.9) |
| 4 | 25–32 | กลับบ้าน เล่าเรื่อง อำลา Max | Torto + Nina | Final กับ Teacher John (32.3) |

**จำนวนโหนดแต่ละชนิด**

| ชนิด | จำนวน | มี pool |
|---|---|---|
| new_words | 68 | – (58 วัตถุดิบก่อน lesson + 10 More Words หลัง lesson) |
| lesson | 71 | ✔ `flow` 663 ขั้น (เช็กความเข้าใจ 221 ข้อ) |
| say_it | 52 | ✔ 328 ข้อ |
| emoji_speak | 40 | – (รายการคำอยู่ใน `teach`) |
| conversation | 28 | – |
| see_and_say | 26 | ✔ 149 ข้อ |
| story_bites | 14 | ✔ 42 ข้อ (คลิปละ 3 คำถาม) |
| hear_it | 12 | ✔ 66 ข้อ |
| pronunciation | 10 | – |
| interactive_scenario | 4 | – (สเปกอยู่ใน `teach`) |
| explain_it | 3 | ✔ 9 การ์ด |

---

## 4. โครงสร้างข้อมูล (`adventure-a2-course.json`)

```jsonc
{
  "course": "Adventure A2",
  "version": "a2-merged-2026-10-02",
  "status": "qa-passed-ready-for-implementation",
  "nodeTypes": ["lesson","new_words","say_it","emoji_speak","see_and_say","hear_it",
                "story_bites","explain_it","pronunciation","conversation","interactive_scenario"],
  "cast": "<cast_brief.md เป็นข้อความ>",
  "chapters": {
    "1": { "story": "...", "twist": "...", "outcome": "...",
           "npc": [{ "name": "Teacher Bee", "role": "...", "hook": "..." }] }
  },
  "nodes": [ /* 333 โหนด เรียงตามลำดับที่ผู้เรียนเจอ */ ]
}
```

**ฟิลด์ของแต่ละโหนด**

| ฟิลด์ | ความหมาย |
|---|---|
| `code` | `"<บท>.<ลำดับ>"` เช่น `"15.3"` ลำดับในอาร์เรย์คือลำดับเล่นจริง · แนะนำทำ id ถาวรเป็น `a2_c15n03` |
| `title` | `"English / ไทย"` |
| `type` | ชนิดโหนด (ดูข้อ 5) |
| `flag` | `true` = ต้องเปิด feature flag ก่อน (see_and_say 5 โหนด + explain_it ทั้ง 3) |
| `beat` | Ki / Sho / Ten / Ketsu |
| `axes` | ความยาก 5 แกน เป็นสตริง 5 หลัก |
| `teach` | สเปกเนื้อหาสำหรับคนเขียน/ครู (`**ตัวหนา**` = คำหรือโครงสร้างที่สอน · ด่านคำศัพท์อ่านจากตรงนี้) |
| `say` | ประโยคหลักที่ผู้เรียนต้องพูดได้ (ถ้าโหนดมี pool ประโยคนี้อยู่ใน pool เสมอ) |
| `chapter` | ชื่อบทภาษาไทย |
| `goal` | เป้าหมายด้านความหมาย |
| `accept` | กติกาการรับคำตอบของชนิดนี้ |
| `hint` | กติกา hint 2 ระดับของชนิดนี้ |
| `pool` | อาร์เรย์คำถาม (เฉพาะ 5 ชนิด ดูด้านล่าง) |
| `flow` | เฉพาะ `lesson`: `{titleEn, titleTh, goalTh, steps[]}` ดูข้อ 4.1 |

**รูปแบบ item ใน pool**

```jsonc
// say_it
{ "th": "บอก Max ว่า เมื่อวานฉันอยู่บ้าน", "en": "I was at home yesterday.", "accept": ["Yesterday I was at home."] }
// see_and_say — pic = brief สำหรับทำภาพ ต้องมีข้อมูลที่ต้องพูดครบ
{ "pic": "บอร์ดดิ้งพาสของทีม: ✈️ 10:40 · 🚪 Gate 9", "en": "Our flight is at 10:40. We have to go to Gate 9.", "accept": [...] }
// hear_it — audio = สคริปต์เสียง, q = คำถามภาษาไทยบนจอ
{ "audio": "♪ I love my bus! ♪ Next stop, the museum!", "q": "ป้ายถัดไปคือที่ไหน", "en": "The museum", "accept": ["Museum"] }
// story_bites — item แรกมีสคริปต์คลิป, item 2–3 ใส่ "(คลิปเดิม)"
{ "audio": "<สคริปต์คลิปเต็ม>", "q": "Who is the new teacher?", "en": "Teacher Nina.", "accept": ["Nina."] }
// explain_it — การ์ด: ภาพ + คำเป้าหมาย (ห้ามพูด), en = คำใบ้ตัวอย่าง
{ "pic": "ภาพร่ม ☂️ · คำเป้าหมายบนการ์ด: umbrella (ห้ามพูด)", "en": "You use it when it rains.", "accept": ["..."] }
```

`en` คือคำตอบหลัก ส่วน `accept` คือคำตอบอื่นที่ถือว่าถูกด้วย ให้ grader รับได้ทั้งคู่ (ตรวจแบบ normalize ตัวพิมพ์และเครื่องหมายวรรคตอน)

---

### 4.1 Lesson flow (`node.flow`)

ใช้รูปแบบเดียวกับ `V7_LEGACY_FLOWS` ของ A1 V7 (helper `task` / `choiceTask` / `listen` / `finish` ใน `foundation-v7-legacy-flows.ts`)

```jsonc
{ "titleEn": "I Enjoy Baking", "titleTh": "ฉันชอบอบขนม", "goalTh": "...",
  "steps": [
    { "kind": "task", "text": "… cook → cooking = การทำอาหาร “I like cooking.” แปลว่าฉันชอบทำอาหาร ลองพูดตามครับ", "expectedSpeech": "I like cooking." },
    { "kind": "choice", "answerMode": "single",
      "text": "May ชอบทำเค้กมาก 🧁 ประโยคไหนตรงกับ May ครับ?", "stem": "I love ...",
      "options": [ { "emoji": "🧁", "label": "baking", "speak": "I love baking." },
                   { "emoji": "🎮", "label": "gaming", "speak": "I love gaming." } ],
      "expectedSpeech": "I love baking.",
      "successText": "I love baking. แปลว่า “ฉันรักการอบขนม” ครับ ",
      "incorrectHintTh": "May ชอบทำเค้ก ใช้ baking ครับ พูดว่า I love baking." },
    { "kind": "choice", "answerMode": "any", "text": "แล้วคุณล่ะครับ …", "stem": "I enjoy ...", "options": [ … ], "expectedSpeech": "I enjoy baking." },
    { "kind": "finish", "text": "จบบทครับ …" }
  ] }
```

| `flow.steps[].kind` | แปลงเป็น | หมายเหตุ |
|---|---|---|
| `task` | `task(text, expectedSpeech)` | ครูอธิบาย + ตัวอย่าง + ให้พูดตาม (ไมค์) |
| `choice` + `single` | `choiceTask(text, expectedSpeech, stem, options, successText, false, incorrectHintTh)` | **คำถามเช็กความเข้าใจ** ผู้เรียนแตะการ์ดแล้วพูดประโยค · ทุกตัวเลือกเป็นภาษาอังกฤษที่ถูกไวยากรณ์ ผิดแค่ไม่ตรงสถานการณ์ |
| `choice` + `any` | `choiceTask(…, any = true)` | ทุกตัวเลือกถูก ใช้ตอนท้ายให้พูดเรื่องตัวเอง |
| `listen` | `listen(text)` | ไม่ใช้ไมค์ |
| `finish` | `finish(text)` | สรุปบท |

> lesson ที่ dev ทำไว้ใน `adventure-a2-lessons.authoring.json` (18 บท แบบ blocks + choice เดียว) ให้แทนด้วย flow ชุดนี้ทั้งหมด เพราะแบบเดิมมีคำถามเช็กความเข้าใจแค่ 1 ข้อและเป็นแบบ "any"

## 5. ชนิดโหนดและสิ่งที่ต้องทำในแอป

> ใช้ชื่อชนิดตามสเปกนี้ (`see_and_say`, `story_bites`, `hear_it` (ชื่อบนจอ: Listen Up), `explain_it`) ส่วนโค้ดเดิมที่ยังใช้ชื่ออื่นจะตามแก้ทีหลัง (ดูข้อ 11)

| ชนิด | กลไก | สถานะใน runtime ตอนนี้ | งานที่ต้องทำ |
|---|---|---|---|
| `lesson` | เล่นตาม `flow`: task (ครูอธิบายสั้น + ตัวอย่าง + ให้พูดตาม) · **choice single = คำถามเช็กความเข้าใจ** (สถานการณ์ภาษาไทย 2–3 ตัวเลือก ถูกข้อเดียว) · choice any (เลือกพูดเรื่องตัวเอง) · finish | runtime ของ A1 V7 รองรับรูปแบบนี้แล้ว (`V7_LEGACY_FLOWS` / `buildFoundationV7Steps`) | แปลง `flow.steps` เป็น `V7TeachingStep` (ดูข้อ 4.1) |
| `new_words` | **รากศัพท์ 3–4 คำ** (noun / verb รูปปกติ / คุณศัพท์ง่าย) ฟัง → พูดตาม ห้ามวลี ห้ามรูป -ing / -ed / อดีต · วางเป็น**วัตถุดิบก่อน lesson** หรือเป็น **More Words หลัง lesson** (ตามด้วยการฝึกรูปประโยคเดิม) | มีแล้ว | – |
| `say_it` | โจทย์ไทย → พูดประโยคอังกฤษ 4–7 ข้อ ทบทวนรูปประโยคจาก lesson | มีแล้ว | รองรับ `accept[]` |
| `emoji_speak` | เห็น emoji หรือภาพฉาก → พูดคำ/ก้อนคำที่เรียนแล้ว **ไม่ทาย tense** | มีแล้ว | วลีบางโหนดใช้ "ภาพฉาก + บอลลูนคำพูด" แทน emoji เดี่ยว (16.7, 30.6, 31.8) |
| `see_and_say` | ดูภาพหรือการ์ด → พูด 1 ประโยค ข้อมูลที่ต้องพูดต้องอยู่บนภาพ | runtime ใช้ชื่อ `describe_it` | ใช้ชื่อใหม่ · แสดงภาพจาก `pic` brief |
| `story_bites` | คลิป 15–30 วินาที → ตอบ 3 คำถามด้วยเสียง เปิดดูซ้ำได้ | มีแล้ว | ผลิตคลิป 14 ตัวตามสคริปต์ |
| `hear_it` (ชื่อบนจอ: Listen Up) | เสียงทางเดียว (ประกาศ ข้อความเสียง วิทยุ) → **พูด**ข้อมูลสำคัญ ไม่ใช่แตะ | **ยังไม่มี** (`info_task` ใกล้สุด แต่ `INFO_TASK_ENABLED=false`) | สร้างชนิดใหม่: แสดงคำถามก่อนเล่นเสียง · ซ่อน transcript จนตอบเสร็จหรือกดขอ · เล่นซ้ำได้ |
| `explain_it` | การ์ดแสดง **ภาพ + คำเป้าหมายที่ห้ามพูด** → ผู้เรียนอธิบาย → AI ทายคำ | **ยังไม่มีใน learn-path** (มี module `src/explain-it` แยกอยู่) | ผ่านเมื่อ AI ทายถูกและผู้เรียนไม่พูดคำเป้าหมาย · พูดคำเป้าหมาย = ลองใหม่ไม่เสียดาว |
| `pronunciation` | ฟังตัวอย่าง → ฝึกเสียงเป้าหมาย | มีแล้ว | – |
| `conversation` | คุยกับตัวละคร 5–7 turns ไม่เกิน 3 นาที **3 เป้าหมายเสมอ** ผู้เรียนต้องถามอย่างน้อย 1 ครั้ง | มีแล้ว | เป้าหมายแต่ละโหนดอยู่ใน `teach` |
| `interactive_scenario` | Checkpoint ทุก 8 บท (8.9 · 16.10 · 24.8 · 32.3) | มีแล้ว (ใช้ใน A1 Final) | ดูข้อ 6.2 |

---

## 6. งานพัฒนา (เรียงตาม priority)

### P0 — ต้องมีก่อนปล่อยโซน 1
1. **Import course JSON** → learn-path A2 ตามลำดับใน `nodes` พร้อม id ถาวร
2. **Lesson ใช้ `flow`** ผ่าน runtime แบบ V7 legacy flow (ข้อ 4.1) แทน lesson spec แบบ blocks เดิม
3. **Grader รองรับ `accept[]`** สำหรับทุกชนิดที่มี pool
4. **Hint 2 ระดับ** ทุกชนิดที่ตอบได้ (ข้อความอยู่ในฟิลด์ `hint`)
   - ใช้ hint แล้ว**ไม่หักดาว**
   - บันทึกผลเป็น `assisted` หรือ `independent`
5. **story_bites:** รองรับสคริปต์และคำถาม 3 ข้อจาก pool เปิดดูซ้ำได้ไม่จำกัด
6. **ชื่อชนิด `see_and_say`:** ใช้ใน A2 (ทำ alias ไป renderer เดิมของ `describe_it` ได้)

### P1 — ต้องมีก่อนโซน 1 จบ (บท 7–8)
6. **`hear_it` (ชื่อบนจอ: Listen Up) ชนิดใหม่**
   - ใช้ครั้งแรกที่ 7.7 · มี 12 โหนด 66 ข้อ
   - แสดงคำถามก่อนเล่นเสียง และซ่อน transcript จนตอบเสร็จหรือกดขอ
   - ผู้เรียนตอบด้วยเสียง
   - grader รับคำตอบสั้นแค่ข้อมูลสำคัญได้ เช่น "Gate 12", "6:30"
7. **interactive_scenario (checkpoint) สเปกเดียวกันทุกอัน**
   - 3 ฉาก × 4 turns ฉากละไม่เกิน 3 นาที **บันทึกผลจบแต่ละฉาก** ออกแล้วกลับมาเล่นต่อได้
   - ผสม turn ธรรมดา / emoji / ภาพ ตามตัวเลขที่ระบุใน `teach`
   - ไม่เฉลยแล้วข้าม: ให้ลองใหม่ได้ · hint ไม่หักดาว

### P2 — ต้องมีก่อนโซน 4 (บท 27)
8. **`explain_it` ชนิดใหม่**
   - 3 โหนด: 28.10 · 30.8 · 31.9 · การ์ดละ 1 คำเป้าหมาย รวม 9 การ์ด
   - AI รับคำอธิบายของผู้เรียน แล้วทายคำ
   - ผ่านเมื่อ AI ทายถูก
   - ตรวจว่าผู้เรียนไม่พูดคำเป้าหมาย ถ้าพูดให้ลองใหม่
   - มี sentence starter: "It's a… / You use it when… / This person…"
9. **Feature flag:** โหนดที่ `flag: true` ทั้ง 8 โหนดต้องเปิด flag ก่อนแสดง

### Nice to have
- การ์ดสะสมตัวละครเมื่อเจอครูคนใหม่ (8.10 Nina · 16.11 Torto)
- ใช้ภาพ Player avatar (อารมณ์ tired / hungry / hot / cold / sick) ในบท 22 และ 25

---

## 7. กฎเนื้อหาที่ต้องคงไว้ (qa.py ตรวจให้อัตโนมัติ)

| รหัส | กฎ |
|---|---|
| E1 | โครงสร้าง pool ครบ · say_it / see_and_say / hear_it มี 4–7 ข้อ · story_bites / explain_it มี 3 |
| E2 | `say` ของโหนดต้องอยู่ใน pool |
| E3 | ห้ามคำตอบซ้ำ · โจทย์เดียวต้องมีคำตอบเดียว |
| E4 | คำตอบต้องมีหลักฐาน: ตัวเลขอยู่ในภาพ · ข้อมูลอยู่ในเสียงหรือสคริปต์คลิป |
| E5 | ห้ามใช้ไวยากรณ์ก่อน lesson ที่สอน (qa.py หา lesson นั้นเองในบทที่กำหนด) เช่น was/were และ -ed บท 15 · อดีตผิดรูปบท 16 · Did บท 17 · should บท 22 · present perfect บท 26 |
| E6 | **ด่านคำศัพท์:** ทุกคำอังกฤษใน pool ต้องสอนแล้วใน A1 V7 หรือใน A2 ก่อนถึงโหนดนั้น (ยกเว้นคำไวยากรณ์ ชื่อ และคำยืม café / hotel / ice cream / mall / TV / pizza / sushi) |
| E7 | ด่านคำศัพท์เดียวกันสำหรับ emoji_speak และ `say` ของ conversation / scenario |
| E8 | ตัวละคร: ห้ามใช้ชื่อที่ตัดออกแล้ว · ห้าม he/she กับครูบีและ Capy · Nina ห้ามโผล่ก่อน 8.10 · Torto ห้ามโผล่ก่อน 16.11 |
| E9 | ห้ามโหนดชนิดเดียวกันติดกัน · ห้าม new_words → say_it · บทละไม่เกิน 11 โหนด |
| E10 | new_words มี 3–4 คำ และต้องเป็นคำเดี่ยว (noun / verb / คุณศัพท์ง่าย หรือคำนามประสม เช่น bus stop) ห้ามวลี |
| E11 | new_words ต้องตามด้วย lesson ที่ใช้คำชุดนั้นทันที หรือเป็น "More Words" หลัง lesson ที่ตามด้วยการฝึกรูปประโยคนั้น |
| E12 | new_words ต้องเป็นรากศัพท์ (cook ไม่ใช่ cooking) รูป -ing / -ed / อดีตสอนใน lesson |
| E13 | ทุก lesson มี flow 6–12 ขั้น · เปิดด้วย task · จบด้วย finish · **เช็กความเข้าใจแบบถูกข้อเดียว ≥ 2 ข้อ** · ห้าม task ติดกันเกิน 2 ขั้น · คำตอบที่ถูกต้องอยู่ในตัวเลือก · มี successText และ incorrectHintTh · คำอังกฤษทุกคำสอนแล้ว |

กฎอื่นที่ใช้ตอนเขียนเนื้อหา (ถ้าจะเพิ่มหรือแก้เนื้อหา):
- **บทละ 1–2 แนวคิดไวยากรณ์ใหม่** เช่น บท 15 สอนแค่ was/were กับ -ed
- **emoji_speak ทายคำ ไม่ทาย tense** ถ้าเป็นวลีให้ใช้ภาพฉาก
- **see_and_say:** ข้อมูลอยู่บนภาพ ห้ามให้เดาเจตนาหรืออารมณ์
- **explain_it:** คำเป้าหมายต้องสอนแล้ว และคำใบ้ห้ามมีคำเป้าหมาย
- **โหนดที่ซ้ำกับ A1:** เขียนเป็น "ทบทวนแล้วต่อยอด" (1.1, 2.7, 3.3, 5.2, 6.5, 11.6)

> **CI:** ให้ `python3 qa.py` เป็น gate ใน pipeline ของ content ถ้าไม่ได้ `ERRORS: 0` ห้าม merge หรือ deploy

---

## 8. ตัวละคร (รายละเอียดใน `cast_brief.md`)

| ตัวละคร | บทบาท | ช่วงที่ปรากฏ | สรรพนาม |
|---|---|---|---|
| Teacher Bee (ครูบี) | ครูคนแรก · กล้วยใส่แว่น | โซน 1 · กลับมาบท 31 | **ใช้ชื่อแทนเสมอ** |
| Capy | คาปิบารา ลูกคู่ของครูบี ไม่ใช่ครู | ตามทีมไปทุกโซน | **ใช้ชื่อแทนเสมอ** |
| Teacher John | ครูจาก A1 | ส่งไม้ต่อในบท 1 · โผล่เป็นระยะ · Final บท 32 | he |
| Teacher Nina | ครูคนที่ 2 | ตั้งแต่ 8.10 | she |
| Teacher Torto | ครูคนที่ 3 คุณตาอายุ 60+ (ไม่ใช่เต่า) | ตั้งแต่ 16.11 | he |
| Max · May | ผู้เรียนจาก A1 | ทั้งคอร์ส | he · she |
| Mali | พนักงานบริการ (ทำงานทุกที่ เป็น running gag) | ทั้งคอร์ส | she |
| Aunt Noi | ป้าของ May อายุ 50+ | บท 11–12, 15, 31 | she |
| Driver Dave | คนขับรถเมล์ที่ร้องเพลงตลอด | บท 19 | he |
| DJ Coco | ดีเจพยากรณ์อากาศ ใช้แค่เสียง | บท 21 | he |

ไม่มีตัวละครที่มีชื่ออื่นนอกจากนี้ คนแปลกหน้าในต่างประเทศเป็นบทบาทไม่มีชื่อ เช่น เจ้าหน้าที่ พนักงานต้อนรับ เภสัชกร

---

## 9. Asset ที่ต้องผลิต

| Asset | จำนวน | แหล่งข้อมูล |
|---|---|---|
| ภาพ see_and_say | ~149 ภาพ | `pool[].pic` (brief มีข้อมูลที่ต้องเห็นครบ) |
| ภาพการ์ด explain_it | 9 การ์ด | `pool[].pic` + คำเป้าหมาย |
| คลิป story_bites (15–30 วินาที) | 14 คลิป | สคริปต์ใน `pool[0].audio` |
| เสียง hear_it | 66 ไฟล์ | `pool[].audio` (ใช้เสียง Bee, Mali, Driver Dave, DJ Coco, Torto และเสียงประกาศทั่วไป) |
| ภาพ / turn ของ checkpoint | 4 scenario | `teach` ของ 8.9 · 16.10 · 24.8 · 32.3 |
| Character sheet ใหม่ | Aunt Noi · Driver Dave (DJ Coco ใช้แค่เสียง) | `cast_brief.md` |

> **สำคัญ:** หลังผลิตภาพหรือคลิปเสร็จ ต้องมีคนเช็กว่าข้อมูลบนภาพและในเสียงตรงกับคำตอบใน pool ก่อนขึ้นจริง ภาพที่ผิดจาก brief ทำให้โจทย์มีหลายคำตอบ

---

## 10. Acceptance criteria

- [ ] Import ครบ 328 โหนด
- [ ] lesson ทั้ง 71 บทเล่นตาม `flow` และมีคำถามเช็กความเข้าใจแบบถูกข้อเดียวอย่างน้อย 2 ข้อต่อบท ลำดับตรงกับ JSON และมี id ถาวร
- [ ] `python3 qa.py` → `ERRORS: 0` บนไฟล์ที่ import จริง
- [ ] ทุกข้อใน pool ตอบด้วย `en` หรือคำใดใน `accept` แล้วผ่าน
- [ ] Hint ใช้ได้ทุกชนิด ไม่หักดาว และบันทึก assisted / independent
- [ ] hear_it แสดงคำถามก่อนเสียง ซ่อน transcript และตอบด้วยเสียง
- [ ] Checkpoint บันทึกผลจบแต่ละฉาก และกลับมาเล่นต่อจากฉากที่ค้างได้
- [ ] explain_it ไม่ให้ผ่านถ้าผู้เรียนพูดคำเป้าหมาย
- [ ] โหนด `flag: true` ซ่อนอยู่จนเปิด flag
- [ ] ตรวจ asset เทียบกับ pool แล้ว (ข้อ 9)

---

## 11. สิ่งที่เปลี่ยนในรอบ 3 (หลังทดลองเล่นครั้งที่ 2)

- **new_words สอนรากศัพท์:** 1.1 เปลี่ยนจาก gaming / cycling / baking / hiking เป็น game · cycle · bake · hike ส่วนการเติม -ing สอนใน lesson 1.2 (cook → cooking = การทำอาหาร) · 6.2 painting → paint · egg / flower เป็นรูปเอกพจน์
- **เพิ่ม More Words 10 จุด:**

| โหนด | คำ |
|---|---|
| 1.6 | fish · jog · surf · skate |
| 5.5 | climb · ride · fly · kite |
| 9.6 | muffin · cookie · juice · cocoa |
| 12.6 | stir · pour · chop · peel |
| 15.5 | clean · relax · chat · text |
| 21.3 | windy · rainy · foggy · cool |
| 22.3 | toothache · backache · earache · dentist |
| 23.7 | charger · notebook · headphones |
| 26.4 | surf · dive · elephant · cave |
| 29.4 | fresh · dirty · awful |

- **Lesson flow ครบ 71 บท:** แต่ละบทมี 8–10 ขั้น เช็กความเข้าใจ 2–4 ข้อ (รวม 221 ข้อ) ไม่มี task ติดกันเกิน 2 ขั้น · ตัวเลือกทุกข้อเป็นประโยคที่ถูกไวยากรณ์ (ตรวจและแก้ ~80 ข้อที่เคยใช้ประโยคผิดเป็นตัวหลอก)

## 11.1 สิ่งที่เปลี่ยนในรอบ 2 (หลังทดลองเล่นครั้งแรก)

- **new_words:** จาก 83 โหนด เหลือ 58 โหนด ทุกโหนดเป็นคำเดี่ยว และตามด้วย lesson ที่เอาคำชุดนั้นมาแต่งประโยคทันที
- **ย้ายวลีและรูปไวยากรณ์จาก new_words เข้า lesson**
  - Come on! / Hurry up! · next time · Just looking, thanks.
  - always / usually · went / ate / bought · been / seen
  - get on / off · look for · hold on / hang up
- **lesson:** เพิ่มเป็น 71 โหนด lesson ใหม่ที่เพิ่มเข้ามา เช่น Whose Is This?, What Is She Like?, Maybe Next Time, Night Market Phrases, Our Floating Market Day, How to Take It, Two Days Ago
- **ตัดออก:** ชุดคำที่ไม่ได้ใช้ประกอบประโยค และ explain_it 1 โหนด (บท 27)

## 12. ยังไม่ทำในรอบนี้ / ทำทีหลัง

- **โค้ดเดิมที่ใช้ชื่อชนิดเก่า:** `describe_it` → `see_and_say` และเปิดใช้ `info_task` / `hear_it` (ชื่อบนจอ: Listen Up) จะตามแก้ทีหลัง (ตอนนี้ทำ alias ไปก่อน)
- **คำชมของครู** (Great job / Nice try / Try again) และวลีขอให้ครูช่วย: ตัดออกจาก A2 แล้ว จะไปสอนเป็น new_words ใน A1
- **Doc เก่า "Adventure A2 — Course Structure":** ยังเป็นฉบับก่อนรวม ให้ยึด JSON ในแพ็กเกจนี้

---

## 13. รอ Product ตัดสินใจ (ไม่ block การ implement)

1. **ชื่อครู:** "Teacher B" (ตาม character sheet) หรือ "Teacher Bee" (ตามพรอมต์ A1) ตอนนี้ใช้ "Teacher Bee"
2. **เพศของครูบีและ Capy:** ตอนนี้ใช้ชื่อแทนสรรพนามทุกจุด
3. **คำว่า "call":** จะสอนก่อนบท 30 ไหม ตอนนี้ pool ก่อนบท 30 เลี่ยงคำนี้อยู่
4. **Teacher Bogie:** มี character sheet แต่ไม่ได้ใช้ใน A2
