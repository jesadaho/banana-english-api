import type { PlacementQuestion, PlacementStageId } from './placement.types';

export const PLACEMENT_STAGES: Array<{
  id: PlacementStageId;
  questionIds: string[];
}> = [
  {
    id: 'foundation_entry',
    questionIds: ['Q01', 'Q02', 'Q03', 'Q04', 'Q05', 'Q06'],
  },
  { id: 'a1', questionIds: ['Q07', 'Q08', 'Q09', 'Q10'] },
  { id: 'a2', questionIds: ['Q11', 'Q12', 'Q13', 'Q14', 'Q15', 'Q16'] },
  { id: 'b1', questionIds: ['Q17', 'Q18', 'Q19', 'Q20'] },
];

export const PLACEMENT_QUESTION_IDS = PLACEMENT_STAGES.flatMap(
  (stage) => stage.questionIds,
);
export const PLACEMENT_PROGRESS_MAX = PLACEMENT_QUESTION_IDS.length;

/** @deprecated Use PLACEMENT_STAGES. Kept as an alias for scenario chrome. */
export const PLACEMENT_BANDS = PLACEMENT_STAGES;

const MAY_READING = 'describe-it/fnd_v7_u13n05/01-she-is-reading.webp';
const MAY_READING_FACTS =
  'Girl at a wooden table, brown hair, cream top, open blue book, chair. Do not treat prior answers as the colour.';

export const PLACEMENT_QUESTIONS: PlacementQuestion[] = [
  {
    id: 'Q01',
    stage: 'foundation_entry',
    skill: 'personal information / be',
    npcEn: 'Hi, {name}! How are you today, and where do you live?',
    target: 'ตอบความรู้สึกและที่อยู่ สองข้อมูลตาม prompt',
    requiredEvidence: 'A feeling/state and a place the speaker lives',
    anchors2: ["I'm good. I live in Bangkok.", 'Good, thanks. In Chiang Mai.'],
    anchors1: ['Good.'],
    delivery: 'text_audio',
  },
  {
    id: 'Q02',
    stage: 'foundation_entry',
    skill: 'people / relationship',
    npcEn:
      'Tell me about someone in your family or a friend. Who are they, and what are they like?',
    target: 'ระบุความสัมพันธ์และลักษณะง่าย ๆ',
    requiredEvidence:
      'A relationship and a simple trait; invented people are fine',
    anchors2: ['She is my sister. She is kind.', 'My friend is funny.'],
    anchors1: ['My sister.', 'Friend… happy.'],
    delivery: 'text_audio',
  },
  {
    id: 'Q03',
    stage: 'foundation_entry',
    skill: 'A1 simple picture description',
    npcEn: 'Look at this picture. Tell me about the person and what you can see.',
    target: 'บรรยายคนและสิ่งของ/ลักษณะอย่างน้อยสองรายละเอียด',
    requiredEvidence: 'Person plus at least one other visible detail',
    anchors2: [
      'There is a girl. She has a blue book.',
      'A girl is at a table with a book.',
    ],
    anchors1: ['A book.', 'Girl, book, table.'],
    delivery: 'picture_text_audio',
    imagePath: MAY_READING,
    sceneFacts: MAY_READING_FACTS,
  },
  {
    id: 'Q04',
    stage: 'foundation_entry',
    skill: 'possession / have / plural',
    npcEn: 'These things belong to May and Max. Tell me what they have.',
    target: 'ระบุ keys เป็นหลายชิ้นและเชื่อมเจ้าของกับสิ่งของ',
    requiredEvidence: 'Plural keys linked to owners; counting three is not required',
    anchors2: [
      'They have keys.',
      'These are their keys.',
      'May and Max have three keys.',
    ],
    anchors1: ['Keys.', 'They have a key.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/fnd_v7_u07n04/05-may-max-their-keys.webp',
    sceneFacts:
      'May and Max portraits linked to three keys. Target is ownership plus plural, not a count quiz.',
  },
  {
    id: 'Q05',
    stage: 'foundation_entry',
    skill: 'polite request',
    npcEn: 'You want to borrow the book. Ask me politely.',
    target: 'สร้างคำขอยืมหนังสือที่สุภาพและเข้าใจได้',
    requiredEvidence: 'A polite request for the book; please is optional',
    anchors2: [
      'Can I borrow the book, please?',
      'Can I have the book?',
      'The book, please.',
    ],
    anchors1: ['Book.', 'Give me book.'],
    delivery: 'picture_text_audio',
    imagePath: MAY_READING,
    sceneFacts: MAY_READING_FACTS,
  },
  {
    id: 'Q06',
    stage: 'foundation_entry',
    skill: 'negative / colour',
    npcEn: "Is the book red? Tell me its colour.",
    target: 'ปฏิเสธข้อมูลผิดและบอกสีจริง',
    requiredEvidence: 'Rejects red and names blue; do not use prior turns as a colour leak',
    anchors2: ["No, it's blue.", "It isn't red. It's blue."],
    anchors1: ['No.', 'Blue.'],
    delivery: 'picture_text_audio',
    imagePath: MAY_READING,
    sceneFacts: MAY_READING_FACTS,
  },
  {
    id: 'Q07',
    stage: 'a1',
    skill: 'routine / time',
    npcEn:
      'What time does May wake up? Tell me one thing you usually do in the morning, too.',
    target: 'อ่านเวลา 7:00 และบอกกิจวัตรตนหนึ่งกิจกรรม',
    requiredEvidence: 'Clock time seven and one personal morning activity',
    anchors2: [
      'At seven. I usually have breakfast.',
      'She wakes up at seven, and I go to work in the morning.',
    ],
    anchors1: ['At seven.', 'I have breakfast.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/fnd_v7_u12n06/01-she-wakes-at-seven.webp',
    sceneFacts: 'May wakes; digital clock shows 7:00. Third-person -s is not scored alone.',
  },
  {
    id: 'Q08',
    stage: 'a1',
    skill: 'preference / ability',
    npcEn: 'What do you like doing in your free time, and what can you do well?',
    target: 'บอกความชอบและความสามารถ',
    requiredEvidence:
      'A like and an ability; they may be the same activity; can is optional',
    anchors2: [
      'I like cooking, and I can cook rice well.',
      "I like games. I'm good at drawing.",
    ],
    anchors1: ['I like games.', 'Games… swim.'],
    delivery: 'text_audio',
  },
  {
    id: 'Q09',
    stage: 'a1',
    skill: 'initiating a question / price',
    npcEn: 'You want to know the price of this shirt. Ask me.',
    target: 'ผู้เรียนเป็นฝ่ายถามราคา',
    requiredEvidence: 'A question about price, not stating a price',
    anchors2: ['How much is this shirt?', "What's the price?", 'How much?'],
    anchors1: ['Price?', 'This shirt… money?'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/v7_finale_n01/13-red-shirt-price-question.webp',
    sceneFacts: 'One red shirt with a blank tag; no printed price.',
    afterScoreEn: "It's fifty baht.",
  },
  {
    id: 'Q10',
    stage: 'a1',
    skill: 'current action / position',
    npcEn: 'What is the boy doing, and where is he?',
    target: 'บอกกิจกรรมกำลังเกิดและสถานที่/ตำแหน่งง่าย ๆ',
    requiredEvidence: 'An ongoing action and a place; lake is not required',
    anchors2: ["He's running. He's in a park.", "He's running by the lake."],
    anchors1: ['Running.', 'He is in a park.'],
    delivery: 'picture_text_audio',
    imagePath: 'describe-it/a2_c05n07/01.webp',
    sceneFacts:
      'Boy running/jogging by a lake in a park, backpack, trees. walking/jogging/running and park/lake/outside are acceptable.',
  },
  {
    id: 'Q11',
    stage: 'a2',
    skill: 'A2 past activity',
    npcEn: 'Tell me about last weekend. What did you do, and who were you with?',
    target: 'กิจกรรมในอดีตและผู้ร่วมกิจกรรม/อยู่คนเดียว',
    requiredEvidence: 'Past activity plus companion or alone',
    anchors2: ['I went shopping with my friend.', 'I stayed home alone.'],
    anchors1: ['I went shopping.', 'I go shopping with my friend.'],
    delivery: 'audio_only',
    transitionTh:
      'ต่อไปลองฟังครูบีโดยไม่มีข้อความนะครับ กดฟังซ้ำได้เหมือนเดิม',
  },
  {
    id: 'Q12',
    stage: 'a2',
    skill: 'A2 future plan / invitation',
    npcEn: 'What are you going to do this weekend? Invite me to join you.',
    target: 'สื่อแผนอนาคตและชวนคู่สนทนา',
    requiredEvidence: 'A future plan and an invitation; going to is not required',
    anchors2: [
      "I'm going to the park. Would you like to come?",
      "I'll play football. Do you want to join me?",
    ],
    anchors1: ["I'm going to the park.", 'Come?'],
    delivery: 'audio_only',
    afterScoreEn: "That sounds nice. I'd love to.",
  },
  {
    id: 'Q13',
    stage: 'a2',
    skill: 'A2 connected picture description',
    npcEn:
      'Tell me about the people in this picture, what they are doing, and where they are.',
    target: 'บรรยายคนสองคน การกระทำ/ท่าทาง และตำแหน่งให้เข้าใจเป็นฉากเดียว',
    requiredEvidence:
      'Two people, an action/posture, and a place; waiting is not required',
    anchors2: [
      "A boy and a girl are by a closed door. He's looking at his watch, and she's looking at the door.",
    ],
    anchors1: ['They are standing.', 'Boy, girl, door.'],
    delivery: 'picture_audio',
    imagePath: 'describe-it/fnd_v7_u13n05/03-they-are-waiting.webp',
    sceneFacts:
      'Two people by a closed wooden door; boy checks a wristwatch; girl faces the door. Do not require the word waiting.',
  },
  {
    id: 'Q14',
    stage: 'a2',
    skill: 'A2 preference / reason',
    npcEn:
      'Would you prefer a day at the beach or in the mountains? Tell me why.',
    target: 'เลือกและอธิบายเหตุผลที่มีสาระ',
    requiredEvidence: 'A choice plus a clear reason; because is optional',
    anchors2: [
      "I'd choose the beach because I like swimming.",
      'The mountains. I like quiet places.',
    ],
    anchors1: ['The beach.', 'Beach… beautiful.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q15',
    stage: 'a2',
    skill: 'A2 suggestion / problem',
    npcEn: "Our bus is late, and we're getting hungry. What should we do?",
    target: 'เสนอวิธีจัดการที่สมเหตุสมผล',
    requiredEvidence: 'A usable suggestion for the late-bus/hungry situation',
    anchors2: [
      "Let's buy a snack while we wait.",
      'We could eat here and take the next bus.',
    ],
    anchors1: ['Food… shop.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q16',
    stage: 'a2',
    skill: 'A2 contingency',
    npcEn: 'It might rain this afternoon. What will you do if it rains?',
    target: 'วางแผนตอบรับเหตุการณ์ที่เป็นไปได้',
    requiredEvidence: 'A plan if it rains; full if-will form is optional',
    anchors2: ["If it rains, I'll go to a café.", 'We can visit a museum.'],
    anchors1: ['Umbrella.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q17',
    stage: 'b1',
    skill: 'B1 connected narration',
    npcEn: 'Tell me about a day you remember well. What happened?',
    target: 'เล่าลำดับเหตุการณ์พร้อมรายละเอียดให้ตามเรื่องได้',
    requiredEvidence: 'Connected past narration with sequence or detail',
    anchors2: [
      'Last month I went to the beach with my family. We went swimming, and later we had lunch by the sea.',
    ],
    anchors1: ['I went to the beach. It was good.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q18',
    stage: 'b1',
    skill: 'B1 problem / response / outcome',
    npcEn: 'Tell me about a time a plan changed. What happened, and what did you do?',
    target: 'อธิบายปัญหา การตอบสนอง และสิ่งที่เกิดตามมา',
    requiredEvidence: 'Problem, response, and outcome',
    anchors2: [
      'It started raining, so we went to a museum instead. We stayed there until the rain stopped.',
    ],
    anchors1: ['It rained. We stayed home.'],
    delivery: 'audio_only',
  },
  {
    id: 'Q19',
    stage: 'b1',
    skill: 'B1 supported opinion',
    npcEn:
      'Is it better to plan a day out or decide as you go? Explain your opinion with an example.',
    target: 'ความเห็น เหตุผล และตัวอย่างที่เกี่ยวข้อง',
    requiredEvidence: 'Opinion, reason, and an example',
    anchors2: [
      'I prefer planning because it saves time. For example, I can book tickets before they sell out.',
    ],
    anchors1: ["Planning is better because it's good."],
    delivery: 'audio_only',
  },
  {
    id: 'Q20',
    stage: 'b1',
    skill: 'B1 compromise',
    npcEn:
      'You want a quiet day, but your friend wants lots of activities. How could you plan a day you both enjoy?',
    target: 'เสนอแผนรองรับทั้งสองฝ่ายและอธิบายความเชื่อมโยง',
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
