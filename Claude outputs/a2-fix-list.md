# Adventure A2 — รายการที่ต้องแก้ (รอบ review บท 1–4 + สแกนทั้งคอร์ส)

> อัปเดต 5 ต.ค. 2026 · เช็กจาก working tree ล่าสุดแล้ว รายการที่ทำเสร็จแล้วไม่อยู่ในนี้
> (เสร็จแล้ว: 2.4 สคริปต์ใหม่ · 2.5 Frequency Pack แบบ `layout: "list"` · 2.8 May Practices · 4.2 สคริปต์ใหม่ · 4.6 Say It)

**กฎหลักที่ใช้ตัดสินทุกข้อ:** 1 บทเรียน = 1 สูตร (คำในช่องว่าง ≤ 4 คำ) · 6–8 ขั้น · ขั้น listen ≤ 1 · ของที่เกินย้ายไป Pack (list view) / Say It / บทหลัง · ไม่ใช้ศัพท์ไวยากรณ์ในข้อความผู้เรียน

---

## A. แก้ได้เลย (บท 1–4)

### 🔴 บั๊ก / ผู้เรียนติด
- [ ] **1.8 Listen Up — hint เฉลยคำตอบ:** ข้อ 2–5 hint ระดับแรกเป็น `"Swimming. …"` = คำตอบเต็ม → เปลี่ยนเป็น `["S…", "S_______."]` แบบข้อ 1
- [ ] **1.8 ข้อ 3 — ไม่รู้ว่าใครพูด:** เสียงไม่ได้บอกชื่อ แต่ถามว่า "Max ทำอะไร" → audio: `"Hey! It's Max. I go jogging on weekends. How about you?"`
- [ ] **1.4 ใช้ jogging ก่อนสอน jog:** สลับลำดับ 1.4 ↔ 1.5 (More Words: fish · jog · surf · skate มาก่อน On Weekends) แล้วเช็ก E9/E11
- [ ] **1.4 "Me too!" ผิดจังหวะ:** ตอนนี้ครูบีพูด "…on weekends, too." แล้วให้ผู้เรียนพูด Me too! (ซ้ำซ้อน) → ให้ครูบีพูดก่อน เช่น ขั้นที่ครูบอก `I enjoy jogging.` แล้วผู้เรียนตอบ `Me too!`
- [ ] **1.4 ไม่มีขั้นเลือกตอบเลย** (ฟัง 3 + พูดตาม 5) → เพิ่ม choice single อย่างน้อย 1 ขั้น และลดขั้นฟังเหลือ 1 (เนื้อหาคงไว้ทั้ง What do you like doing? และ What do you do on weekends? ตามที่ PM ยืนยัน)
- [ ] **2.10 Brother's Schedule ขึ้น "เร็ว ๆ นี้" กลางบท** → ใส่ `featureFlag: "adventure_a2_optional"` เหมือน 3.8 / 4.9 (บท 2 จะเห็น 11 โหนด)

### 🟠 เนื้อหาให้ตรงกับที่ตกลง
- [ ] **2.6 Say It — ใช้ชุดใหม่** (ตอนนี้ยังไม่มี often เลย):

| # | promptTh | answerEn | acceptedAnswers |
|---|---|---|---|
| 1 | คุณทำอาหารบ่อยแค่ไหน? | How often do you cook? | – |
| 2 | ปกติฉันตื่นเจ็ดโมง | I usually get up at seven. | I usually wake up at seven. |
| 3 | บางครั้งฉันทำการบ้านหลังกินข้าวเย็น | I sometimes do my homework after dinner. | Sometimes I do my homework after dinner. · I sometimes do homework after dinner. |
| 4 | ฉันไม่เคยจัดเตียงเลย | I never make the bed. | I never make my bed. |
| 5 | ฉันกินข้าวเช้าเสมอ | I always have breakfast. | I always eat breakfast. |
| 6 | ฉันไปวิ่งจ๊อกกิ้งบ่อย | I often go jogging. | I go jogging often. |
| 7 | ฉันอาบน้ำทุกวัน | I take a shower every day. | I have a shower every day. |

- [ ] **2.2 ข้อความขั้นแรก:** "กิจวัตรภาษาอังกฤษมักพูดเป็นคู่ กริยา + คำนาม" → "กิจวัตรภาษาอังกฤษมักพูดเป็นคู่คำ"
- [ ] **2.3 Emoji Speak:** ตอนนี้ทายคำนามซ้ำกับ 2.1 → เปลี่ยนคำตอบเป็นคู่คำ 🍳 have breakfast · 🚿 take a shower · 📚 do homework · 🍽️ have dinner · 🛏️ make the bed (และใช้คำแปล "จัดเตียง" ให้ตรงกับ 2.2)
- [ ] **Frequency Pack (2.5) UI** ตาม mockup + ปรับ:
  1. ตัวอย่างใช้ `have breakfast` (ไม่ใช่ eat) ให้ตรง 2.2
  2. ประโยคตัวอย่างเปลี่ยนตามแถวที่ไฮไลต์ (`I usually have breakfast.` …) คำที่เปลี่ยนเป็นสีเขียว
  3. แถว never ใส่ "0" หรือขอบแดงอ่อน ไม่ให้ดูเหมือนล็อก
  4. แถวที่พูดแล้วมี ✓
  5. ไมค์ต้องอยู่ในจอโดยไม่ต้องเลื่อนบนจอเล็ก
  6. หน้าจบ: รายการ ✓ ครบ แตะฟังได้ แล้วไปต่อ

### 🟡 ความต่อเนื่องของเรื่อง / ตัวละคร
- [ ] **บท 4 ตามหา Mali ซ้ำ:** 4.2 ไม่หาแล้ว ✔ แต่ 4.10 Conversation เปิดด้วย "What does Mali look like?" อีก ทั้งที่ 4.5 เจอแล้ว → เปลี่ยนโจทย์ 4.10 เป็นช่วยครูบีชี้ "คนใหม่" คนอื่นในงาน (เช่น หาเพื่อนของ May) หรือให้เริ่มตอนยังไม่เจอแล้วตัดการหาใน 4.5
- [ ] **4.10 ใช้คำว่า coach** (ยังไม่สอน) → `"That's Teacher John. He's very kind. Enjoy the party!"`
- [ ] **goal ของ Conversation 1.9 / 2.12 เรียกครูบีว่า he / his** → ใช้ "Teacher Bee" (ครูบีห้ามใช้สรรพนาม)
- [ ] **3.5:** ขั้นฟังบอก "The key is behind the sofa." แต่ขั้นต่อมาบอกว่าหลังโซฟาไม่มีกุญแจ → เปลี่ยนตัวอย่างเป็น "The bag is behind the sofa."
- [ ] **emoji ซ้ำความหมาย:** 📚 = books (3.3) และ shelf (3.4, 3.6) → shelf ใช้ 🗄️ · 🏠 = club (1.3) และ house (3.2) → club ใช้ 🎪 หรือ 🏕️ · 🐭 = short (4.1) → ใช้ 📏⬇️ หรือภาพคนตัวเล็ก
- [ ] **team / friend (1.3) ไม่ถูกใช้อีกเลย** → ใส่ใน 1.9 Conversation (เช่น ครูบี "Welcome to the team!" / ผู้เรียน "Let's be friends!") อย่างน้อยคนละ 1 ครั้ง
- [ ] **ชื่อบท 1.2 ไม่ตรงกัน:** catalog "ฉันชอบอบขนม" vs lesson "ฉันสนุกกับการอบขนม" → ใช้ "ฉันสนุกกับการอบขนม"

---

## B. รอ PM ตัดสินใจ
- [ ] **ผม Mali:** บทเรียนใช้ "short curly hair" (4.5, 4.6, 4.10) แต่ character sheet เป็นผมหยักศก (wavy) → เปลี่ยนเนื้อหาเป็น wavy หรือแก้ภาพ?

---

## C. บท 5–31 (งานใหญ่ — เนื้อหาจาก Claude/PM จะส่งตามทีละโซน)

### C1. ทุกบทเรียนบท 5–31 ยังเป็นเวอร์ชันเก่า (11–12 ขั้น มีอุ่นเครื่อง + listen หลายขั้น)
ต้องแปลงเป็นแบบต้นแบบ 1.2 (6–8 ขั้น · listen ≤ 1) เหมือนที่ทำบท 1–4 แล้ว → **รอสคริปต์ใหม่**

### C2. บทที่อัดหลายกฎ / แอบสอนไวยากรณ์ (ทำพร้อม C1)

| บท | ปัญหา | ทางแก้ |
|---|---|---|
| 11.3 + 11.6 | นับได้/นับไม่ได้ 2 บทติด + ภาชนะ | รวมเหลือ 1 บท (not many / not much + How many / How much) · ภาชนะ → **Pack** |
| 13.2 | -er · more · better | **Pack** รูปเทียบ · บทฝึก `This one is ___ than that one.` |
| 14.6 | -est · the most · the best | **Pack** รูปที่สุด · บทฝึก `This is the ___ one.` |
| 16.3 | went · ate · bought · gave + Was it…? | **Pack** คำเปลี่ยนรูป · ตัด Was it…? |
| 15.4 | I was · We were · Was it? · Were you? | ตัด Were you…? → Say It |
| 25.8 | exciting/excited + There were a lot of + boring + How was? | เหลือคู่ exciting / excited |
| 27.7 | got wet · when · while | เหลือ `I was ___ing when…` |
| 28.7 | for · since · How long…? | เหลือ for + How long…? |
| 30.2 | already · yet · just · has he…? | เหลือ already + yet |
| 12.2 | แทรก them (สรรพนาม) | ใช้ชื่อของแทน `Then, cut the carrots.` |
| 12.5 | + really well | ตัด really well |

### C3. Pack แบบ list view ที่จะเพิ่ม (ใช้ `layout: "list"` ที่ทำไว้แล้ว)
- ภาชนะ (11.x): a carton · a bottle · a packet · a kilo
- เทียบ (13.x): cheaper · bigger · better · more expensive
- ที่สุด (14.x): the cheapest · the cutest · the best · the most beautiful
- คำเปลี่ยนรูปเรื่องที่ผ่านมา (16.x): went · ate · bought · gave
- แต่ละ Pack ตามด้วย Say It ทบทวน · บทละไม่เกิน 11 โหนด (ถ้าเกินให้ซ่อน See and Say ที่ยังรอภาพ)

---

## D. หลังแก้ต้องผ่าน
- [ ] `python3 scripts/a2/qa.py` → `ERRORS: 0`
- [ ] เล่นจริงบท 1–4 ต่อเนื่อง: ไม่มีคำที่ใช้ก่อนสอน · ไม่มีโหนด "เร็ว ๆ นี้" กลางบท · hint ระดับแรกไม่เฉลย

---

## ผลตรวจรอบที่ 1 (commit 21893bd · 5 ต.ค.)
ส่วน A ทำครบทุกข้อ ✅ · qa.py ERRORS 0 · โค้ดที่ไม่ใช่ test คอมไพล์ผ่าน (tsc)

### ต้องแก้เพิ่ม
- [ ] **node id เลื่อนตามลำดับ:** id สร้างจากตำแหน่ง (a2_c01n04 เดิม = On Weekends ตอนนี้ = Emoji Speak) ผู้เล่น playtest ที่เคยทำ 1.3–1.6 / 2.5–2.11 จะได้ความคืบหน้าผิดโหนด → ทำ migration map แบบ `foundation-v7-ch14-16-migration.ts` หรือเปลี่ยนเป็น id ถาวรที่ไม่ผูกกับลำดับ (แผนข้อ 4 แนะนำไว้)
- [ ] **4.10 Teacher John ใส่แว่น:** character sheet ของ John ไม่มีแว่น (ผมน้ำตาลอ่อน หูฟังคล้องคอ ถือกาแฟ) → เปลี่ยนเป็น "a man with headphones" หรือให้คนใส่แว่นเป็นคนอื่น
- [ ] **List view ไม่มีคำแปลใต้ประโยคตัวอย่าง** (mockup มี "ฉันกินอาหารเช้าเสมอ") → เพิ่ม `exampleTh` ต่อคำ หรือ `meaningTh` ของประโยค

### ข้อสังเกต (ไม่ block)
- คำชมภาษาอังกฤษ: แทนเฉพาะคำขึ้นต้นในรายการ regex — successText ที่ขึ้นด้วย "ใช่เลย" / "เป๊ะ" ยังเป็นไทย → เพิ่มใน regex ให้สม่ำเสมอ
- qa E9 ขยายเป็น ≤ 12 โหนดทั้งคอร์ส — ควรยกเว้นเฉพาะบทที่มีโหนดรอภาพ (flag) แทนการขยายทุกบท
- test type errors (adventure-a2-path.test.ts 7 จุด, ไฟล์ A1 อื่น ๆ) เป็นแบบเดียวกับที่มีอยู่เดิม ไม่กระทบตอนรัน (tsx ไม่เช็ก type)
- รัน `npm run test:foundation-v7` ใน VM ไม่ได้ (node_modules เป็น darwin) → ให้ dev รันบนเครื่องก่อน push

---

## เปลี่ยนชื่อ Hear It → **Listen Up** (5 ต.ค.)
เปลี่ยนเฉพาะชื่อที่ผู้เรียนเห็น · type ภายในยังเป็น `hear_it` (ไม่ต้องย้ายข้อมูล / ไม่กระทบ progress)
- [ ] `banana-english-app/lib/features/learn/presentation/widgets/foundation_map/foundation_path_layout.dart:245` → `'Listen Up'`
- [ ] `banana-english-app/lib/features/listen_answer/presentation/listen_answer_screen.dart:321` fallbackTitle → `'Listen Up'`
- [ ] (ไม่บังคับ) ข้อความ error / comment ใน API: `mini-games.controller.ts:167`, `hear-it.data.ts:20`

### ⚠️ เจอระหว่างค้น
- [ ] **`HEAR_IT_ENABLED = false`** (`src/hear-it/hear-it.data.ts:21`) → โหนด Listen Up ทุกโหนดขึ้น "เร็ว ๆ นี้" รวม **A2 1.8 Club Voices** ที่เราเอามาแทน Story Bite ในบท 1 → ผู้เรียนบท 1 ไม่ได้เล่นเกมฟังเลย ถ้าฝั่งแอปพร้อมแล้วให้เปิดเป็น `true` (หรือเปิดเฉพาะ A2)

---

# รอบ 6 ต.ค. — List-view packs · Times of Day (A1) · Passive

## E. Feature เพิ่มใน list view (`new_words` + `layout: "list"`)
ตอนนี้รองรับ: แถบ `level` · `note` · `example` (ประโยคเดียวทั้ง pack) · ✓ แถวที่พูดแล้ว · หน้าทบทวน
ต้องเพิ่ม:
- [ ] `item.base` — แสดง "cheap → **cheaper**" (พูดเฉพาะ `answer`)
- [ ] `item.time` — ข้อความช่วงเวลาแทนแถบ (เช่น `06:00–12:00`)
- [ ] `item.example` + `item.exampleTh` — ประโยคตัวอย่างรายแถว (override `example` ของ pack) และคำแปลใต้ประโยค
- [ ] `contextItems` — แถวที่แสดงแต่ไม่ต้องพูด (แตะฟังได้ สีจาง หรือ ✓ ถ้าเรียนแล้ว)
- [ ] แถวที่ไม่มี `level` / `time` → แสดง emoji ของแถวในช่องขวา (ไม่ปล่อยว่าง)
- [ ] รายการยาว (7–12 แถว) เลื่อนได้ แต่ไมค์อยู่ในจอเสมอ
- [ ] qa.py E10: list view นับเฉพาะแถวที่พูด (≤ 5) ไม่นับ `contextItems`
- ทุก pack ต้องตามด้วยเกมฝึก (Say It) ตามกฎ E11

## F. Pack ที่จะเพิ่มใน A2 (7 ชุด)
| # | วางที่ | Pack | แถว (บน → ล่าง) | ตัวอย่าง |
|---|---|---|---|---|
| 1 | ใหม่ หลัง 10.2 | ความแรง | too ●●●●● เกินไป · really ●●●●○ มาก ๆ · quite ●●●○○ ค่อนข้าง · a bit ●●○○○ นิดหน่อย | It's ___ spicy. |
| 2 | ใหม่ หลัง 21.2 | ความแน่นอน | will ●●●●● แน่นอน · will probably ●●●●○ น่าจะ · might ●●○○○ อาจจะ · won't ○○○○○ ไม่แน่นอน | It ___ rain tomorrow. |
| 3 | แทน 29.4 Good or Bad? | ให้คะแนน | amazing ●●●●● สุดยอด · great ●●●●○ ดีมาก · OK ●●●○○ พอใช้ · bad ●●○○○ แย่ · awful ●○○○○ แย่มาก | The food was ___. |
| 4 | ใหม่ หลัง 11.3 | ปริมาณ | a lot of ●●●●● เยอะ · some ●●●○○ มีบ้าง · a little ●●○○○ นิดหน่อย · no ○○○○○ ไม่มีเลย | There's ___ milk. |
| 5 | ใหม่ หลัง 13.2 | เทียบ (`base`) | cheap → cheaper ถูกกว่า · big → bigger ใหญ่กว่า · good → better ดีกว่า · expensive → more expensive แพงกว่า | This one is ___ than that one. |
| 6 | ใหม่ หลัง 14.6 | ที่สุด (`base`) | cheap → the cheapest · cute → the cutest · good → the best · beautiful → the most beautiful | This is ___ one. |
| 7 | ใหม่ หลัง 16.3 | เรื่องที่ผ่านไปแล้ว (`base`, ตัวอย่างรายแถว) | go → went · eat → ate · buy → bought · give → gave | We went to the market. · I ate noodles. · May bought a mango. · Max gave a gift. |

หมายเหตุ:
- #3 แทน 29.4: คำเดิม fresh · dirty ต้องย้ายไป 29.6 (เช็ก pool 29.5 Emoji ที่ใช้คำพวกนี้)
- #4 ไม่แทน 11.5 (ภาชนะยังเป็นวัตถุดิบของ 11.6)
- จำนวนโหนดหลังเพิ่ม: บท 10 → 10 · 11 → 11 · 13 → 11 · 14 / 16 / 21 → 12 · 29 → 11 (เท่าเดิม)
- Say It ที่ตามหลังแต่ละ pack: Claude จะส่งพร้อมสคริปต์บทเรียนรอบถัดไป

## G. A1
- [ ] **Times of Day (ใหม่) — บท 12 ระหว่าง 12.2 My Day กับ 12.3 Emoji** (id A1 เป็นแบบถาวร แทรกได้ไม่กระทบ progress)

| แถว | คำ | `time` | ความหมาย | `example` | พูด? |
|---|---|---|---|---|---|
| 🌄 | dawn | 05:00–06:00 | รุ่งสาง | I get up at dawn. | context |
| 🌅 | morning | 06:00–12:00 | เช้า | I study in the morning. | ✅ |
| ☀️ | noon | 12:00 | เที่ยงวัน | I eat lunch at noon. | ✅ |
| 🌤️ | afternoon | 12:00–17:00 | บ่าย | I work in the afternoon. | ✅ |
| 🌇 | evening | 17:00–21:00 | เย็น–หัวค่ำ | I cook in the evening. | ✅ |
| 🌙 | night | 21:00–05:00 | กลางคืน | I sleep at night. | ✅ |
| 🕛 | midnight | 00:00 | เที่ยงคืน | I go to bed at midnight. | context |

  `note`: "ช่วงเวลาโดยประมาณ" · ต่อด้วย 12.x Say It My Day Mix +2 ข้อ: "ฉันตื่นตอนเช้า" → `I wake up in the morning.` · "ฉันดูทีวีตอนกลางคืน" → `I watch TV at night.` · Conversation Make a Morning Plan รับ in the morning / at night
- [ ] **Days 1 / Days 2 (บท 9) และ Months 1–3 (บท 15) → list view** โดยไม่ย้ายโหนด: ทุกโหนดแสดงรายการเต็ม (7 วัน / 12 เดือน) ฝึกเฉพาะชุดของโหนดนั้น ที่เหลือเป็น `contextItems` (ชุดที่เรียนแล้วขึ้น ✓)

## H. Passive (ยังไม่เคยสอนในคอร์ส) — ⏳ รอสคริปต์จาก Claude
สอนเป็นก้อนสำเร็จรูป ไม่อธิบายกฎ · บทละ 2 โหนด (New Words + Lesson 6–8 ขั้น)
- [ ] **บท 23 ของหาย (แนะนำ ทำก่อน):** `My ___ was stolen.` · `Was it stolen?` — วัตถุดิบ: steal · pickpocket · police · ต่อเนื่องกับบท 24 ที่ใช้ `was cancelled` → บท 23 เป็น 12 โหนด
- [ ] **บท 8 ตลาดนัด (เลือกทำ):** `It's made of ___.` · `What's it made of?` · `It's made in Thailand.` — วัตถุดิบ: wood · silk · silver · paper → บท 8 เป็น 12 โหนด
- ไม่ทำ: passive แบบ by / รูปอื่น (เก็บไว้ B1) · `It was built in…` ใส่เป็น Say It บท 26 ได้ 1 ข้อหลังสอนบท 23

## H ✅ ทำแล้ว (Claude, 6 ต.ค.) — passive บท 23
- เพิ่ม 23.10 New Words "Stolen!" (steal · thief · police) → `scripts/a2/content/zone3-passive-words.json`
- เพิ่ม 23.11 Lesson "It Was Stolen!" 7 ขั้นตามต้นแบบ 1.2 (`handAuthoredFlow: true`): My wallet was stolen. → เลือก phone → พูดเอง handbag → Was it stolen? (Nina: No, I left it on the bus!) → เลือก I lost my bag. vs My bag was stolen. → เลือกของตัวเอง → จบ ปูไป Conversation
- Conversation Lost Bag เลื่อนเป็น 23.12 (บท 23 ยังไม่ปล่อย id เลื่อนได้ ไม่กระทบผู้เล่น)
- vocabgate: stolen → steal · qa E5: กฎ "passive was stolen" เริ่มบท 23 · test: node 330 → 332
- build `--check` ผ่าน · qa ERRORS 0 · ⚠️ ยังไม่ได้รัน `npm run test:foundation-v7` (node_modules เป็น darwin) — รันบนเครื่องก่อน commit
- อัปเดต (รอบ 2): จัดลำดับบท 23 ใหม่ให้มีเกมฝึกตามหลัง → 23.6 New Words Stolen! · 23.7 Lesson It Was Stolen! · **23.8 Say It Tell What Happened** (+ `My wallet was stolen.` · `Was it stolen?` แทนข้อกุญแจบนโต๊ะ) · 23.9 More Words In My Bag · 23.10 See & Say · 23.11 Say It · 23.12 Conversation · บท 23 ยังเป็น 12 โหนด
- 24.1 Zone 3 Warm-up: ข้อ "ฉันทำพาสปอร์ตหาย…" → "พาสปอร์ตของฉันถูกขโมย" → `My passport was stolen.`
- build `--check` ผ่าน · qa ERRORS 0

## I. New Words บท 9–31 (Claude, 8 ต.ค.) ✅
- สาเหตุ "Coming soon": build สร้าง pool New Words จากไฟล์ overlay เท่านั้น และมีแค่ zone1 / list packs / passive → 49 โหนดในบท 9–31 ไม่มี pool
- เพิ่ม `scripts/a2/content/zone2-4-words.json` — 49 pack · 189 คำ (emoji · reading · meaningTh · accept) ตรงกับคำตัวหนาใน `teach` ทุกโหนด
- build `--check` ผ่าน · qa ERRORS 0 · new_words pool 23 → 72
- ยังไม่มีเนื้อหาในบท 9–31: emoji_speak 30 · conversation 21 · pronunciation 8 · interactive_scenario 16.10 / 24.8 / 32.3 · see_and_say 22 (รอภาพ)
