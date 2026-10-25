import type { PlacementQuestion, PlacementStageId } from './placement.types';

export const PLACEMENT_STAGES: Array<{
  id: PlacementStageId;
  questionIds: string[];
}> = [
  {
    id: 'foundation_entry',
    // Easiest first (prod data): Q04/Q05 warm up before Q02/Q03. IDs keep
    // their names so stored results and gates still line up.
    questionIds: ['Q01', 'Q04', 'Q05', 'Q02', 'Q03', 'Q06'],
  },
  { id: 'a1', questionIds: ['Q07', 'Q08', 'Q09', 'Q10'] },
  {
    id: 'a2',
    questionIds: [
      'Q11',
      'Q12',
      'Q13',
      'Q14',
      'Q15',
      'Q16',
      'Q17',
      'Q18',
      'Q19',
      'Q20',
    ],
  },
  { id: 'b1', questionIds: ['Q21', 'Q22', 'Q23', 'Q24', 'Q25'] },
];

export const PLACEMENT_QUESTION_IDS = PLACEMENT_STAGES.flatMap(
  (stage) => stage.questionIds,
);
export const PLACEMENT_PROGRESS_MAX = PLACEMENT_QUESTION_IDS.length;

/** @deprecated Use PLACEMENT_STAGES. Kept as an alias for scenario chrome. */
export const PLACEMENT_BANDS = PLACEMENT_STAGES;

const FINALE = (file: string) => `describe-it/v7_finale_n01/${file}.webp`;

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'Q01',
    stage: 'foundation_entry',
    skill: 'personal information',
    npcEn: 'Where are you from?',
    target: 'บอกถิ่นที่มา/ที่อยู่ที่ตอบได้ในบริบท',
    requiredEvidence: 'A place of origin or home',
    anchors2: ["I'm from Thailand.", 'From Bangkok.'],
    anchors1: ['Me… Thailand… home.'],
    delivery: 'text_audio',
  },
  {
    id: 'Q02',
    stage: 'foundation_entry',
    skill: 'family / person',
    npcEn: 'Tell me about one person in your family or a friend.',
    target: 'แนะนำความสัมพันธ์หรือบอกข้อมูลบุคคลด้วยข้อความง่าย',
    requiredEvidence:
      'A relationship or a simple person description; invented people are fine',
    anchors2: [
      'This is my brother.',
      'My sister is a student.',
      'My friend is funny.',
    ],
    anchors1: ['Sister.'],
    delivery: 'text_audio',
  },
  {
    id: 'Q03',
    stage: 'foundation_entry',
    skill: 'negative / colour',
    npcEn: 'My bag is blue. Is this my bag?',
    target: 'ฟังเงื่อนไขแล้วปฏิเสธกระเป๋าแดงว่าไม่ใช่ของครู',
    requiredEvidence: 'Rejects the red bag as the teacher’s bag; naming the blue bag is not required',
    anchors2: ["No, it isn't.", "No, that's not your bag.", 'No.', "No, it's red."],
    anchors1: ['Red bag.', 'My bag is red.', 'This bag is red.'],
    delivery: 'picture_text_audio',
    imagePath: FINALE('05-red-bag-on-bench'),
    sceneFacts: 'One red bag on a bench. There is no blue bag in the picture.',
  },
  {
    id: 'Q04',
    stage: 'foundation_entry',
    skill: 'contents / inside',
    npcEn: "What's inside the bag?",
    target: 'บอกสิ่งที่อยู่ในกระเป๋าตามภาพ',
    requiredEvidence: 'Names what is inside the bag; ownership phrasing is not required',
    anchors2: ["There's a book.", 'A book.', "There's a yellow book inside."],
    anchors1: ['Book.'],
    delivery: 'picture_text_audio',
    imagePath: FINALE('06-red-bag-yellow-book'),
    sceneFacts: 'A red bag is open, with one yellow book inside.',
  },
  {
    id: 'Q05',
    stage: 'foundation_entry',
    skill: 'simple picture description',
    npcEn: 'Tell me what you can see in this picture.',
    target: 'บรรยายคนหรือการมีสิ่งของด้วยข้อความง่ายที่สัมพันธ์กับภาพ',
    requiredEvidence: 'A simple descriptive phrase about the person or object, not only a word list',
    anchors2: ['A girl has a book.', 'A girl with a blue book.', 'She is reading.'],
    anchors1: ['Book.', 'Girl, book, table.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/fnd_v7_u13n05/01-she-is-reading.webp',
    sceneFacts:
      'May holds an open blue book at a wooden table. Present continuous, names, and colour are optional.',
  },
  {
    id: 'Q06',
    stage: 'foundation_entry',
    skill: 'ownership / plural',
    npcEn: 'These things belong to May and Max. Tell me what they have.',
    target: 'เชื่อมเจ้าของกับ keys หลายดอก',
    requiredEvidence: 'Plural keys linked to owners; counting three is not required',
    anchors2: ['They have keys.', 'These are their keys.'],
    anchors1: ['Keys.', 'They have a key.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/fnd_v7_u07n04/05-may-max-their-keys.webp',
    sceneFacts:
      'May and Max portraits linked to three keys. Do not score a guessed plural if ASR is unclear.',
  },
  {
    id: 'Q07',
    stage: 'a1',
    skill: 'routine / time',
    npcEn: "This is May's morning. Tell me about it.",
    target: 'บอกกิจวัตรที่ภาพแสดงพร้อมเวลา',
    requiredEvidence: 'The pictured morning event plus the time seven',
    anchors2: ['She wakes up at seven.', 'May gets up at seven.'],
    anchors1: ['At seven.', 'She wakes up.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/fnd_v7_u12n06/01-she-wakes-at-seven.webp',
    sceneFacts: 'May waking on a bed; clock shows 7:00. Only this event is in the picture.',
  },
  {
    id: 'Q08',
    stage: 'a1',
    skill: 'current action',
    npcEn: 'What is Max doing now?',
    target: 'สื่อการกระทำกำลังเกิด',
    requiredEvidence: 'An action in progress; place is not required',
    anchors2: ["He's eating.", 'Max is eating a sandwich.'],
    anchors1: ['Eat.', 'He eats.'],
    delivery: 'picture_text_audio',
    imagePath: FINALE('10-max-eating-now'),
    sceneFacts: 'Max is eating a sandwich now.',
  },
  {
    id: 'Q09',
    stage: 'a1',
    skill: 'ask price',
    npcEn: 'You want this red shirt. Ask me the price.',
    target: 'เป็นฝ่ายถามราคาตามสถานการณ์',
    requiredEvidence: 'A question about price, not stating a price',
    anchors2: ['How much is it?', 'How much?', "What's the price?"],
    anchors1: ['Price?', 'Shirt… money?'],
    delivery: 'picture_text_audio',
    imagePath: FINALE('13-red-shirt-price-question'),
    sceneFacts: 'One red shirt with a tag that does not show a price.',
    afterScoreEn: "It's fifty baht.",
  },
  {
    id: 'Q10',
    stage: 'a1',
    skill: 'directions',
    npcEn: 'I need to get to that door. Which way do I go?',
    target: 'บอกทางตรงแล้วเลี้ยวซ้ายตามเส้นทางที่เห็น',
    requiredEvidence: 'Both go-straight and turn-left, as one route',
    anchors2: ['Go straight, then turn left.', 'Straight, then left.'],
    anchors1: ['Go straight.', 'Turn left.'],
    delivery: 'picture_text_audio',
    imagePath: FINALE('15-straight-then-left'),
    sceneFacts: 'A path goes straight then turns left to a door.',
  },
  {
    id: 'Q11',
    stage: 'a2',
    skill: 'travel information',
    npcEn: "We're going to Old Town. What time is the next bus?",
    target: 'ฟังคำถามแล้วเลือกเที่ยวรถถัดไปตามเวลาปัจจุบันในภาพ',
    requiredEvidence: 'The next bus after 09:10, which is 09:30',
    anchors2: ['At nine thirty.', 'The next bus leaves at nine thirty.'],
    anchors1: ['At nine.'],
    delivery: 'picture_audio',
    imagePath: 'describe-it/a2_c19n09/01.webp',
    sceneFacts:
      'Old Town timetable. NOW 09:10. Departures 09:00 / 09:30 / 10:00. Sign text may stay visible; NPC English is audio-only.',
  },
  {
    id: 'Q12',
    stage: 'a2',
    skill: 'service request',
    npcEn: 'You ordered tea, but I brought you coffee. What would you say to me?',
    target: 'สื่อข้อผิดพลาดและความต้องการให้คู่สนทนาแก้ไขได้',
    requiredEvidence: 'Signals the wrong drink and wants tea instead; apology/modal optional',
    anchors2: [
      'I ordered tea, not coffee.',
      'Could I have tea instead, please?',
    ],
    anchors1: ['Tea.', 'Wrong.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q13',
    stage: 'a2',
    skill: 'past activity',
    npcEn: 'What did you do last weekend?',
    target: 'บอกกิจกรรมที่ผ่านมา',
    requiredEvidence: 'A past activity; companion or reason is not required',
    anchors2: ['I went shopping.', 'I stayed home.'],
    anchors1: ['I go shopping.', 'Shopping.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q14',
    stage: 'a2',
    skill: 'future plan',
    npcEn: 'What are you going to do this weekend?',
    target: 'บอกแผนอนาคต',
    requiredEvidence: 'A future plan; invitation is not required',
    anchors2: ["I'm going to visit my friend.", "I'll stay home."],
    anchors1: ['Friend… weekend.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q15',
    stage: 'a2',
    skill: 'invitation + arranging to meet',
    npcEn: 'Invite me to do something with you this weekend.',
    target: 'ชวนครูทำอะไรสักอย่างในสุดสัปดาห์ แล้วตอบคำถามนัดหมาย',
    requiredEvidence:
      'An invitation on turn 1. Do not require Saturday, and do not require declining a day. A later time or place is scored on the follow-up.',
    anchors2: [
      "Let's go swimming.",
      'Would you like to go to the park with me?',
      "Let's play football.",
    ],
    anchors1: ['Park?'],
    delivery: 'audio_only',
    afterScoreEn: "That sounds nice. I'd love to.",
    followUp: {
      kind: 'invite_schedule',
      timePrompt: 'What time shall we meet?',
      placePrompt: 'Where shall we meet?',
      target: 'ตอบเวลานัดหรือสถานที่นัดให้ตรงคำถาม',
      requiredEvidence:
        'A meeting time or place that answers the follow-up. Short answers such as At ten. or At the park. are score 2.',
      anchors2: ['At ten.', 'At the park.', "Let's meet at ten."],
      anchors1: ['Ten.', 'Park.'],
    },
  },
  {
    id: 'Q16',
    stage: 'a2',
    skill: 'connected picture description',
    npcEn: "Tell me what's happening in this picture.",
    target: 'อธิบายสถานการณ์ด้วยข้อความที่เชื่อมอย่างน้อยสองรายละเอียดที่เห็นได้',
    requiredEvidence:
      'At least two visible details linked in one description; waiting is not required',
    anchors2: [
      'Two people are standing by a door. The boy is looking at his watch.',
    ],
    anchors1: ['They are standing.', 'Boy, girl, door.'],
    delivery: 'picture_audio',
    imagePath: 'describe-it/fnd_v7_u13n05/03-they-are-waiting.webp',
    sceneFacts:
      'May and Max stand by a closed door. Max looks at his watch. May faces the door. Do not require the word waiting.',
  },
  {
    id: 'Q17',
    stage: 'a2',
    skill: 'preference / reason',
    npcEn: 'Would you prefer the beach or the mountains? Why?',
    target: 'เลือกและให้เหตุผลที่สัมพันธ์กัน',
    requiredEvidence: 'A choice plus a related reason; because is optional',
    anchors2: [
      'The beach, because I like swimming.',
      "I'd choose the mountains. I like quiet places.",
    ],
    anchors1: ['The beach.', 'Beautiful.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q18',
    stage: 'a2',
    skill: 'suggestion / problem',
    npcEn: "Our bus is late, and we're getting hungry. What should we do?",
    target: 'เสนอทางออกตามสถานการณ์',
    requiredEvidence: 'A usable suggestion; should-form is optional',
    anchors2: ["Let's buy a snack while we wait.", 'We could eat here.'],
    anchors1: ['Food… shop.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q19',
    stage: 'a2',
    skill: 'comparison for a decision',
    npcEn:
      'The bus costs twenty baht. The taxi costs one hundred baht. Tell me which is cheaper.',
    target: 'ฟังสองราคาและเปรียบเทียบเพื่อเลือกทางเดินทาง',
    requiredEvidence: 'Compares the two prices; choosing the bus without comparison is partial',
    anchors2: ['The bus is cheaper.', 'The bus costs less.'],
    anchors1: ['The bus.', 'Twenty baht.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q20',
    stage: 'a2',
    skill: 'contingency',
    npcEn: 'It might rain this afternoon. What will you do if it rains?',
    target: 'เสนอแผนรับเหตุการณ์ที่เป็นไปได้',
    requiredEvidence: 'A plan if it rains; full if-will is optional',
    anchors2: ['We can go to a café.', "If it rains, I'll stay inside."],
    anchors1: ['Umbrella.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q21',
    stage: 'b1',
    skill: 'connected narration',
    npcEn: 'Tell me about a day you remember well.',
    target: 'เล่าเรื่องมีลำดับและรายละเอียดที่ตามได้ ไม่ใช่รายชื่อกิจกรรมลอย ๆ',
    requiredEvidence: 'Connected past narration with sequence or detail',
    anchors2: [
      'Last month I went to the beach with my family. We went swimming, and later we had lunch by the sea.',
    ],
    anchors1: ['I went to the beach. It was good.'],
    delivery: 'audio_only',
    transitionTh: 'ลองคุยต่ออีกนิดนะครับ',
  },
  {
    id: 'Q22',
    stage: 'b1',
    skill: 'changed plan',
    npcEn: 'Tell me about a time a plan changed and how you handled it.',
    target: 'เล่าการเปลี่ยนแผนและการรับมือเชื่อมกันให้เข้าใจ',
    requiredEvidence: 'A changed plan and how it was handled; works without Q21',
    anchors2: [
      'It started raining, so we went to a museum instead. We stayed there until the rain stopped.',
    ],
    anchors1: ['It rained. Home.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q23',
    stage: 'b1',
    skill: 'supported opinion',
    npcEn:
      'Is it better to plan a day out or decide as you go? Explain your opinion.',
    target: 'ความเห็นกับเหตุผลที่พัฒนา เช่นขยายผลหรือยกตัวอย่าง',
    requiredEvidence: 'An opinion with a substantive reason; example is optional',
    anchors2: [
      'I prefer planning because it saves time. I can book tickets before they sell out.',
    ],
    anchors1: ["Planning is better because it's good."],
    delivery: 'audio_only',
  },
  {
    id: 'Q24',
    stage: 'b1',
    skill: 'explain a problem / request resolution',
    npcEn:
      "You booked a quiet hotel room, but it's very noisy. I'm the receptionist. Explain the problem and ask for a solution.",
    target:
      'อธิบายปัญหาห้องเสียงดังและขอความช่วยเหลือ แล้วเสนอทางออกเมื่อเปลี่ยนห้องไม่ได้',
    requiredEvidence:
      'Turn 1 states the noisy-room problem and asks for help. Turn 2 proposes another solution after the hotel cannot change rooms.',
    anchors2: [
      'My room is noisy. Could I change rooms?',
      'I booked a quiet room, but I can hear loud music next door. Could you move me to another room?',
    ],
    anchors1: ['The room is noisy.'],
    delivery: 'audio_only',
    afterScoreEn: "I'm sorry about that. I'll help you.",
    followUp: {
      kind: 'constraint',
      prompt:
        "We don't have another room tonight. What would you like us to do?",
      target: 'เสนอทางออกรอบสองเมื่อเปลี่ยนห้องไม่ได้',
      requiredEvidence:
        'A usable workaround other than changing rooms now. Short requests are fine.',
      anchors2: [
        'Could you ask the people next door to be quiet?',
        'Could I have earplugs or a quieter room tomorrow?',
      ],
      anchors1: ['Help me.', 'Be quiet.'],
    },
  },
  {
    id: 'Q25',
    stage: 'b1',
    skill: 'compromise',
    npcEn:
      'You want a quiet day, but your friend wants lots of activities. How could you plan a day you both enjoy?',
    target: 'เสนอแผนคำนึงถึงทั้งสองฝ่ายและอธิบาย',
    requiredEvidence: 'A plan that addresses both preferences',
    anchors2: [
      'We could do an activity in the morning and relax in the afternoon, so we both get something we enjoy.',
    ],
    anchors1: ['We can go shopping.'],
    delivery: 'audio_only',
  },
];

export const PLACEMENT_QUESTION_BY_ID = new Map<string, PlacementQuestion>(
  PLACEMENT_QUESTIONS.map((q) => [q.id, q]),
);

export function getPlacementQuestion(id: string): PlacementQuestion | undefined {
  return PLACEMENT_QUESTION_BY_ID.get(id);
}

export function stageIndexForQuestion(id: string): number {
  return PLACEMENT_STAGES.findIndex((s) => s.questionIds.includes(id));
}

export function bandIndexForQuestion(id: string): number {
  return stageIndexForQuestion(id);
}
