import type { LessonConfig } from './lessons.data';

type V6LessonSpec = {
  lessonId: string;
  titleEn: string;
  titleTh: string;
  goalEn: string;
  goalTh: string;
  targets: string[];
  contrast: string;
};

const SPECS: V6LessonSpec[] = [
  { lessonId: 'fnd_v6_be_not_questions', titleEn: 'Not and Questions with Be', titleTh: 'ปฏิเสธและคำถามด้วย Be', goalEn: 'Make negative statements and simple questions with be.', goalTh: 'สร้างประโยคปฏิเสธและคำถามง่าย ๆ ด้วย be', targets: ["I'm not tired.", 'Are you ready?', 'Is she happy?'], contrast: 'statement → negative → question with am/is/are' },
  { lessonId: 'fnd_v6_a_an_one_many', titleEn: 'A, An, One, Many', titleTh: 'หนึ่งและหลายสิ่ง', goalEn: 'Choose a or an and distinguish one from many.', goalTh: 'เลือก a หรือ an และแยกหนึ่งชิ้นกับหลายชิ้น', targets: ['a book', 'an apple', 'many books'], contrast: 'a before a consonant sound; an before a vowel sound; plural -s for many' },
  { lessonId: 'fnd_v6_one_and_many', titleEn: 'One and Many', titleTh: 'หนึ่งชิ้นและหลายชิ้น', goalEn: 'Use singular and regular plural nouns in short sentences.', goalTh: 'ใช้คำนามเอกพจน์และพหูพจน์ในประโยคสั้น', targets: ['one bag', 'two bags', 'three apples'], contrast: 'one + singular noun; number above one + plural noun' },
  { lessonId: 'fnd_v6_this_and_that', titleEn: 'This and That', titleTh: 'สิ่งนี้และสิ่งนั้น', goalEn: 'Point to one near or far thing with this and that.', goalTh: 'ชี้สิ่งของใกล้และไกลด้วย this และ that', targets: ['This is a book.', 'That is a bag.', "What's that?"], contrast: 'this = near; that = far' },
  { lessonId: 'fnd_v6_these_those_details', titleEn: 'These, Those & Details', titleTh: 'สิ่งเหล่านี้ สิ่งเหล่านั้น และรายละเอียด', goalEn: 'Describe near and far plural things with simple details.', goalTh: 'บรรยายสิ่งของหลายชิ้นใกล้และไกลพร้อมรายละเอียดง่าย ๆ', targets: ['These are blue bags.', 'Those are small books.', 'These shoes are black.'], contrast: 'these = near plural; those = far plural; size/color before noun' },
  { lessonId: 'fnd_v6_possessive_adjectives', titleEn: 'My, Your, His, Her', titleTh: 'ของฉัน ของคุณ ของเขา ของเธอ', goalEn: 'Say who owns a thing with my, your, his, and her.', goalTh: 'บอกว่าใครเป็นเจ้าของสิ่งของด้วย my, your, his และ her', targets: ['my bag', 'your book', 'his hat', 'her phone'], contrast: 'owner word goes directly before the thing' },
  { lessonId: 'fnd_v6_have_has', titleEn: 'Have and Has', titleTh: 'มีด้วย Have และ Has', goalEn: 'Use have with I/you/we/they and has with he/she.', goalTh: 'ใช้ have กับ I/you/we/they และ has กับ he/she', targets: ['I have a phone.', 'She has a bag.', 'Do you have a book?'], contrast: 'I/you/we/they have; he/she has' },
  { lessonId: 'fnd_v6_my_day', titleEn: 'My Day', titleTh: 'กิจวัตรของฉัน', goalEn: 'Put familiar daily actions into a short personal routine.', goalTh: 'นำกิจกรรมที่คุ้นเคยมาสร้างกิจวัตรสั้น ๆ ของตนเอง', targets: ['I wake up at seven.', 'I go to work.', 'I eat dinner at six.'], contrast: 'I + daily action; add at + time when useful' },
  { lessonId: 'fnd_v6_action_ing', titleEn: 'Action + ing', titleTh: 'คำกริยาเติม ing', goalEn: 'Form common action words with -ing.', goalTh: 'สร้างคำกริยากิจกรรมทั่วไปด้วย -ing', targets: ['reading', 'running', 'cooking', 'playing'], contrast: 'action verb changes to verb-ing for an action in progress' },
  { lessonId: 'fnd_v6_be_ing_questions', titleEn: 'Be + ing and Questions', titleTh: 'Be + ing และคำถาม', goalEn: 'Say and ask what is happening now.', goalTh: 'พูดและถามถึงสิ่งที่กำลังเกิดขึ้นตอนนี้', targets: ['She is reading.', 'They are playing.', 'What are you doing?'], contrast: 'am/is/are + verb-ing; move be before the subject for yes/no questions' },
  { lessonId: 'fnd_v6_what_who', titleEn: 'What or Who', titleTh: 'อะไรหรือใคร', goalEn: 'Choose what for things and who for people.', goalTh: 'เลือก what สำหรับสิ่งของและ who สำหรับบุคคล', targets: ['What is this?', 'Who is she?', 'Who has the book?'], contrast: 'what asks about a thing; who asks about a person' },
  { lessonId: 'fnd_v6_where_when_how', titleEn: 'Where, When and How', titleTh: 'ที่ไหน เมื่อไร และอย่างไร', goalEn: 'Ask for place, time, age, and price information.', goalTh: 'ถามข้อมูลสถานที่ เวลา อายุ และราคา', targets: ['Where is the school?', 'When does it start?', 'How old are you?', 'How much is it?'], contrast: 'where = place; when = time; how + adjective/adverb = manner or measure' },
  { lessonId: 'fnd_v6_there_is_are', titleEn: 'There Is / There Are', titleTh: 'มีหนึ่งสิ่งและมีหลายสิ่ง', goalEn: 'Say that one or several things exist in a place.', goalTh: 'บอกว่ามีสิ่งของหนึ่งชิ้นหรือหลายชิ้นในสถานที่', targets: ['There is a book.', 'There are two chairs.', 'Is there a bathroom?'], contrast: 'there is + singular; there are + plural' },
  { lessonId: 'fnd_v6_prepositions_place', titleEn: 'In, On, Under, Next To', titleTh: 'ใน บน ใต้ และข้าง ๆ', goalEn: 'Locate things with four basic place words.', goalTh: 'บอกตำแหน่งด้วยคำสถานที่พื้นฐานสี่คำ', targets: ['in the bag', 'on the table', 'under the chair', 'next to the door'], contrast: 'choose the place word from the visual relationship' },
];

function buildV6Lesson(spec: V6LessonSpec): LessonConfig {
  const targets = spec.targets.map((target) => `- ${target}`).join('\n');
  return {
    lessonId: spec.lessonId,
    titleEn: spec.titleEn,
    titleTh: spec.titleTh,
    goalEn: spec.goalEn,
    goalTh: spec.goalTh,
    difficulty: 'beginner',
    languageMix: { thai: 70, english: 30 },
    estimatedMinutesMin: 4,
    estimatedMinutesMax: 5,
    targetPhrases: spec.targets,
    targetLabel: 'sentence',
    maxTurns: 14,
    progressMax: 6,
    systemInstruction: `Foundation A1 V6 lesson: ${spec.titleEn}
Goal: ${spec.goalEn}
Contrast: ${spec.contrast}
Targets:\n${targets}

Teach one private Thai-speaking A1 learner. Use short Thai explanations and model English naturally. Never introduce grammar terminology unless the learner needs it.

Core Flow — move forward only:
1. Model: explain the contrast in one short Thai sentence, model target 1, ask the learner to repeat it.
2. Recognition: give one tiny situation and 2–3 emojiChoice options. The learner chooses and speaks the correct full target.
3. Model target 2 and ask the learner to repeat it.
4. Guided transfer: change one person, number, object, or place. Give a short English stem or emojiChoice, then ask for the full sentence.
5. Recall: ask one simple Thai-to-English prompt with no choices. Accept any clear taught equivalent.
6. Celebrate briefly, summarize what the learner can now do, set isLessonComplete=true and expectsUserSpeech=false.

Error recovery: first error gives a short hint and one retry. After a second error, model the answer once and advance. Never fail or trap the learner. Every speaking turn must set expectedSpeech. Every non-speaking turn sets expectedSpeech="". Return JSON matching the lesson response schema.`,
    openingPrompt: `Start ${spec.titleEn} for one learner. Use their first name once. In Thai, state the practical goal briefly, model "${spec.targets[0]}", and ask them to repeat it. Set expectsUserSpeech=true, expectedSpeech="${spec.targets[0]}", isLessonComplete=false. Return JSON matching the schema.`,
  };
}

export const FOUNDATION_V6_LESSONS: LessonConfig[] = SPECS.map(buildV6Lesson);
export const FOUNDATION_V6_LESSON_IDS = SPECS.map((spec) => spec.lessonId);
