import type { ForcedGuidedBoard } from '../../lessons/lessons.data';
import type { FoundationLessonId } from './foundation.helpers';
import { normalizeFoundationSpeech } from './foundation.helpers';

const FAMILY_VOCAB_OPTIONS = [
  { emoji: '👨‍👩‍👧', label: 'family', speak: 'family' },
  { emoji: '👨', label: 'father', speak: 'father' },
  { emoji: '👩', label: 'mother', speak: 'mother' },
  { emoji: '👦', label: 'brother', speak: 'brother' },
  { emoji: '👧', label: 'sister', speak: 'sister' },
] as const;

function loose(step: number, text: string, rules: Record<number, RegExp>): boolean {
  const re = rules[step];
  if (!re) return false;
  return re.test(normalizeFoundationSpeech(text));
}

export const FOUNDATION_LOOSE_MATCHERS: Record<
  FoundationLessonId,
  (step: number, text: string) => boolean
> = {
  introductions: (step, text) =>
    loose(step, text, {
      1: /^my name is /,
      2: /^i['']?m /,
      4: /^nice to meet you$/,
      5: /^nice to meet you too$/,
      6: /^i['']?m from /,
      7: /^i live in /,
      8: /^i (work as|am a) /,
      9: /^(my name is|i['']?m|i am|nice to meet|i['']?m from|i live|i work)/,
    }),
  yes_no_maybe: (step, text) =>
    loose(step, text, {
      1: /^(yes|no)/,
      2: /^maybe$/,
      3: /^(yes|no)/,
    }),
  polite_expressions: (step, text) =>
    loose(step, text, {
      1: /^(thank|thanks)/,
      2: /^you['']?re welcome$/,
      3: /^(excuse me|sorry|i['']?m sorry)$/,
    }),
  meet_people: (step, text) =>
    loose(step, text, {
      1: /^i am /,
      2: /^i am a /,
      3: /^you are /,
      5: /^i am /,
    }),
  talk_about_groups: (step, text) =>
    loose(step, text, {
      1: /^he is /,
      2: /^she is /,
      3: /^it is /,
      5: /^(he is|she is|it is) /,
    }),
  ee_about_me_family: (step, text) =>
    loose(step, text, {
      1: /^(i['']?m ready|i am ready|ready)$/,
      6: /^this is my /,
      7: /^this is my /,
      8: /^i have /,
      9: /^i have /,
    }),
  numbers: (step, text) =>
    loose(step, text, {
      1: /^(zero|one|two|three|four|five)$/,
      2: /^(six|seven|eight|nine|ten)$/,
      4: /^(eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)$/,
      5: /^twenty$/,
    }),
  telling_time: (step, text) =>
    loose(step, text, {
      1: /^it['']?s .+ o['']?clock$/,
      2: /^it['']?s /,
      3: /^it['']?s .+ (a\.m|p\.m|am|pm)/,
      5: /^it['']?s /,
    }),
  everyday_numbers: (step, text) =>
    loose(step, text, {
      1: /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|one hundred)$/,
      2: /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)-/,
      4: /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)$/,
      5: /^(twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)/,
    }),
  money_prices: (step, text) =>
    loose(step, text, {
      1: /^how much/,
      2: /^it['']?s .+ dollar/,
      3: /^it['']?s (cheap|expensive)$/,
      5: /^it['']?s .+ dollar/,
    }),
  likes_dislikes: (step, text) =>
    loose(step, text, {
      1: /^i like /,
      2: /^i like /,
      3: /^i don['']?t like /,
      5: /^i (like|don['']?t like) /,
    }),
  wants_needs: (step, text) =>
    loose(step, text, {
      1: /^i want /,
      2: /^i need /,
      3: /^i have /,
      5: /^i (want|need|have) /,
    }),
  can_cant: (step, text) =>
    loose(step, text, {
      1: /^i can /,
      2: /^i can['']?t /,
      4: /^i can/,
    }),
  asking_for_help: (step, text) =>
    loose(step, text, {
      1: /^i don['']?t understand$/,
      2: /^can you speak more slowly$/,
      3: /^what does that mean$/,
    }),
  asking_questions: (step, text) =>
    loose(step, text, {
      1: /^(what|where|when|who|how) /,
      2: /^(what|where|when|who|how) /,
      3: /^(what|where|when|who|how) /,
      5: /^(what|where|when|who|how) /,
    }),
};

export const FOUNDATION_BOARDS: Record<
  FoundationLessonId,
  Record<number, ForcedGuidedBoard>
> = {
  introductions: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนรู้การแนะนำตัวเป็นภาษาอังกฤษกันครับ 📝 ลองพูดตามว่า My name is {name} นะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'My name is {name}.',
      options: [{ emoji: '📝', label: 'My name is', speak: 'My name is {name}.' }],
    },
    2: {
      textEn:
        'เก่งมากครับ! อีกแบบหนึ่งที่ใช้บ่อยคือ I\'m {name} ลองพูดตามนะครับ 💬',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm {name}.",
      options: [{ emoji: '💬', label: "I'm", speak: "I'm {name}." }],
    },
    3: {
      textEn:
        'My name is กับ I\'m ใช้ได้ทั้งคู่ครับ แต่ My name is ฟังเป็นทางการกว่านิดหน่อย 📝 ถ้าเจอคนใหม่ครั้งแรก คุณจะใช้แบบไหนครับ?',
      withPraise: true,
      stem: 'My name is...',
      expectedSpeech: 'My name is {name}.',
      options: [
        { emoji: '📝', label: 'My name is', speak: 'My name is {name}.' },
        { emoji: '💬', label: "I'm", speak: "I'm {name}." },
      ],
    },
    4: {
      textEn:
        'เยี่ยมเลยครับ! ต่อไปเวลาเจอคนใหม่เราพูดว่า Nice to meet you 🤝 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Nice to meet you.',
      options: [
        { emoji: '🤝', label: 'Nice to meet you', speak: 'Nice to meet you.' },
      ],
    },
    5: {
      textEn:
        'แล้วถ้าอีกฝ่ายพูดก่อน เราตอบว่า Nice to meet you too 😊 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Nice to meet you too.',
      options: [
        {
          emoji: '😊',
          label: 'Nice to meet you too',
          speak: 'Nice to meet you too.',
        },
      ],
    },
    6: {
      textEn:
        'เก่งมากครับ! ต่อไปบอกว่ามาจากไหน — I\'m from Thailand 🇹🇭 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm from Thailand.",
      options: [
        { emoji: '🇹🇭', label: 'Thailand', speak: "I'm from Thailand." },
        { emoji: '🌏', label: 'Bangkok', speak: "I'm from Bangkok." },
      ],
    },
    7: {
      textEn:
        'แล้วถ้าจะบอกว่าอยู่ที่ไหน — I live in Bangkok 🏙️ ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I live in Bangkok.',
      options: [
        { emoji: '🏙️', label: 'Bangkok', speak: 'I live in Bangkok.' },
        { emoji: '🏡', label: 'Chiang Mai', speak: 'I live in Chiang Mai.' },
      ],
    },
    8: {
      textEn:
        'เยี่ยมเลยครับ! บอกอาชีพหรือว่าเป็นนักเรียนได้ด้วย — I work as a teacher 👩‍🏫 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I work as a teacher.',
      options: [
        {
          emoji: '👩‍🏫',
          label: 'Teacher',
          speak: 'I work as a teacher.',
        },
        { emoji: '🎓', label: 'Student', speak: "I'm a student." },
      ],
    },
    9: {
      textEn:
        'ขั้นตอนสุดท้ายครับ 😊 ลองแนะนำตัวสั้นๆ เป็นภาษาอังกฤษ — ชื่อ + อีกอย่างที่เรียนมา (เช่น มาจากไหน / ทำงานอะไร)',
      advanceQuestionEn: 'Introduce yourself in English.',
      withPraise: true,
      stem: '',
      expectedSpeech: "My name is {name}. I'm from Thailand.",
      options: [
        {
          emoji: '🙋',
          label: 'Self intro',
          speak: "My name is {name}. I'm from Thailand.",
        },
      ],
    },
  },

  yes_no_maybe: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนรู้ตอบคำถม Yes / No กันครับ ✅❌ ถ้าถามว่า Do you like coffee? ลองตอบว่า Yes, I do. นะครับ',
      withPraise: false,
      stem: 'Yes, I do.',
      expectedSpeech: 'Yes, I do.',
      options: [{ emoji: '✅', label: 'Yes, I do', speak: 'Yes, I do.' }],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้ายังไม่แน่ใจ ใช้ Maybe ได้ครับ 🤔 ลองพูดตามว่า Maybe.',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Maybe.',
      options: [{ emoji: '🤔', label: 'Maybe', speak: 'Maybe.' }],
    },
    3: {
      textEn:
        'แล้วถ้าไม่ชอบ ตอบว่า No, I don\'t. ได้ครับ ❌ ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "No, I don't.",
      options: [
        { emoji: '❌', label: "No, I don't", speak: "No, I don't." },
      ],
    },
    4: {
      textEn:
        'Do you speak English? 🇬🇧 คุณจะตอบว่าอะไรครับ?',
      withPraise: true,
      stem: 'Yes, I do. / No, I don\'t.',
      expectedSpeech: 'Yes.',
      options: [
        { emoji: '✅', label: 'Yes', speak: 'Yes.' },
        { emoji: '❌', label: 'No', speak: 'No.' },
        { emoji: '🤔', label: 'Maybe', speak: 'Maybe.' },
      ],
    },
    5: {
      textEn:
        'Do you like pizza? 🍕 ลองตอบด้วยคำตอบสั้นๆ ที่ฟังเป็นธรรมชาติครับ',
      advanceQuestionEn: 'Do you like pizza?',
      withPraise: true,
      stem: 'Yes, I do.',
      expectedSpeech: 'Yes, I do.',
      options: [
        { emoji: '✅', label: 'Yes, I do', speak: 'Yes, I do.' },
        { emoji: '❌', label: "No, I don't", speak: "No, I don't." },
        { emoji: '🤔', label: 'Maybe', speak: 'Maybe.' },
      ],
    },
  },

  polite_expressions: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนคำสุภาพที่ใช้ทุกวันครับ 🙏 เริ่มจาก Thank you — ลองพูดตามว่า Thank you very much.',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Thank you very much.',
      options: [
        {
          emoji: '💝',
          label: 'Thank you',
          speak: 'Thank you very much.',
        },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้ามีคนขอบคุณ เราตอบว่า You\'re welcome 😊 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "You're welcome.",
      options: [
        { emoji: '😊', label: "You're welcome", speak: "You're welcome." },
      ],
    },
    3: {
      textEn:
        'ต่อไป Excuse me ใช้ทักคน หรือขอผ่าน 🙋 และ Sorry ใช้ขอโทษ 😔 ลองพูดตามว่า Excuse me.',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Excuse me.',
      options: [
        { emoji: '🙋', label: 'Excuse me', speak: 'Excuse me.' },
        { emoji: '😔', label: 'Sorry', speak: "I'm sorry." },
      ],
    },
    4: {
      textEn:
        'ถ้ามีคนช่วยคุณยกของหนัก คุณจะพูดว่าอะไรครับ? 🙏',
      withPraise: true,
      stem: 'Thank you',
      expectedSpeech: 'Thank you.',
      options: [
        { emoji: '🙏', label: 'Please', speak: 'Please.' },
        { emoji: '💝', label: 'Thank you', speak: 'Thank you.' },
        { emoji: '😊', label: "You're welcome", speak: "You're welcome." },
        { emoji: '🙋', label: 'Excuse me', speak: 'Excuse me.' },
        { emoji: '😔', label: 'Sorry', speak: 'Sorry.' },
      ],
    },
    5: {
      textEn:
        'ถ้าคุณเดินชนคนโดยไม่ตั้งใจ ควรพูดว่าอะไรครับ? 😔',
      advanceQuestionEn: 'What do you say if you bump into someone?',
      withPraise: true,
      stem: 'Sorry',
      expectedSpeech: "I'm sorry.",
      options: [
        { emoji: '🙏', label: 'Please', speak: 'Please.' },
        { emoji: '💝', label: 'Thank you', speak: 'Thank you.' },
        { emoji: '😊', label: "You're welcome", speak: "You're welcome." },
        { emoji: '🙋', label: 'Excuse me', speak: 'Excuse me.' },
        { emoji: '😔', label: 'Sorry', speak: "I'm sorry." },
      ],
    },
  },

  meet_people: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาฝึกพูดเกี่ยวกับตัวเองและคู่สนทนาครับ 🙋 ถ้าจะบอกว่า "ฉันชื่อเบน" ให้พูดว่า I am {name}. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I am {name}.',
      options: [{ emoji: '🙋', label: 'I am', speak: 'I am {name}.' }],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้าจะบอกว่าเป็นนักเรียน — I am a student. 🎓 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I am a student.',
      options: [
        { emoji: '🎓', label: 'Student', speak: 'I am a student.' },
        { emoji: '💼', label: 'Worker', speak: 'I am a worker.' },
      ],
    },
    3: {
      textEn:
        'ต่อไปพูดกับคนที่คุยด้วย — You are my friend. 👉 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'You are my friend.',
      options: [
        { emoji: '👉', label: 'You are', speak: 'You are my friend.' },
      ],
    },
    4: {
      textEn:
        'ถ้าจะบอกเพื่อนว่าคุณเป็นนักเรียน จะพูดว่าอะไรครับ? 🎓',
      withPraise: true,
      stem: 'I am a student.',
      expectedSpeech: 'I am a student.',
      options: [
        { emoji: '🙋', label: 'I am a student.', speak: 'I am a student.' },
        { emoji: '👉', label: 'You are my friend.', speak: 'You are my friend.' },
      ],
    },
    5: {
      textEn:
        'ลองพูดประโยคสั้นๆ เกี่ยวกับตัวคุณหรือคู่สนทนาครับ 😊',
      advanceQuestionEn: 'Say a short sentence about yourself.',
      withPraise: true,
      stem: 'I am...',
      expectedSpeech: 'I am a student.',
      options: [
        { emoji: '🙋', label: 'I am a student.', speak: 'I am a student.' },
      ],
    },
  },

  talk_about_groups: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาพูดถึงคนอื่นและสิ่งของครับ 👨 ถ้าจะบอกว่า "เขาคือพ่อของฉัน" ให้พูดว่า He is my father. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'He is my father.',
      options: [
        { emoji: '👨', label: 'He is my father.', speak: 'He is my father.' },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้าเป็นผู้หญิง — She is my sister. 👩 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'She is my sister.',
      options: [
        { emoji: '👩', label: 'She is my sister.', speak: 'She is my sister.' },
      ],
    },
    3: {
      textEn:
        'สำหรับสิ่งของ ใช้ It is my bag. 🎒 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'It is my bag.',
      options: [
        { emoji: '🎒', label: 'It is my bag.', speak: 'It is my bag.' },
      ],
    },
    4: {
      textEn:
        'นึกถึงกระเป๋าของคุณครับ 🎒 จะพูดภาษาอังกฤษว่าอะไร?',
      withPraise: true,
      stem: 'It is my bag.',
      expectedSpeech: 'It is my bag.',
      options: [
        { emoji: '👨', label: 'He is my father.', speak: 'He is my father.' },
        { emoji: '👩', label: 'She is my sister.', speak: 'She is my sister.' },
        { emoji: '🎒', label: 'It is my bag.', speak: 'It is my bag.' },
      ],
    },
    5: {
      textEn:
        'ลองพูดประโยคสั้นๆ เกี่ยวกับคนหรือสิ่งของครับ 😊',
      advanceQuestionEn: 'Say a sentence about someone or something.',
      withPraise: true,
      stem: 'He is...',
      expectedSpeech: 'He is my father.',
      options: [
        { emoji: '👨', label: 'He is my father.', speak: 'He is my father.' },
      ],
    },
  },

  ee_about_me_family: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนคำศัพท์ครอบครัวและประโยคง่ายๆ กันครับ 👨‍👩‍👧 พร้อมแล้วพูดว่า I\'m ready ได้เลยครับ 🚀',
      withPraise: false,
      stem: "I'm ready",
      expectedSpeech: "I'm ready",
      options: [{ emoji: '🚀', label: "I'm ready", speak: "I'm ready" }],
    },
    2: {
      textEn:
        'เก่งมากครับ! คำชุดแรก — ครอบครัว คือ family, พี่ชาย/น้องชาย คือ brother, พี่สาว/น้องสาว คือ sister 👦 ลองพูดตามคำว่า brother ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'brother',
      options: [{ emoji: '👦', label: 'brother', speak: 'brother' }],
    },
    3: {
      textEn:
        'ต่อไป พ่อ คือ father, แม่ คือ mother 👩 ลองพูดตามคำว่า mother ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'mother',
      options: [{ emoji: '👩', label: 'mother', speak: 'mother' }],
    },
    4: {
      textEn: 'พ่อ ภาษาอังกฤษพูดว่าอะไรครับ? 👨',
      withPraise: true,
      stem: 'father',
      expectedSpeech: 'father',
      options: [...FAMILY_VOCAB_OPTIONS],
    },
    5: {
      textEn:
        'เยี่ยมเลยครับ! แนะนำคนหนึ่งคน — This is my father. 👨 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'This is my father.',
      options: [
        { emoji: '👨', label: 'This is my father.', speak: 'This is my father.' },
      ],
    },
    6: {
      textEn:
        'ลองแนะนำคนในครอบครัวอีกคนครับ — This is my sister. 👧',
      withPraise: true,
      stem: 'This is my...',
      expectedSpeech: 'This is my sister.',
      options: [
        { emoji: '👧', label: 'This is my sister.', speak: 'This is my sister.' },
      ],
    },
    7: {
      textEn:
        'ต่อไปบอกว่ามีพี่น้องกี่คน — I have one brother. 👦 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I have one brother.',
      options: [
        {
          emoji: '👦',
          label: 'I have one brother.',
          speak: 'I have one brother.',
        },
      ],
    },
    8: {
      textEn:
        'แล้วถ้ามีพี่สาว/น้องสาวสองคน — I have two sisters. 👧👧 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I have two sisters.',
      options: [
        {
          emoji: '👧',
          label: 'I have two sisters.',
          speak: 'I have two sisters.',
        },
      ],
    },
    9: {
      textEn:
        'ขั้นตอนสุดท้ายครับ 😊 เลือกประโยคสั้นๆ เกี่ยวกับครอบครัวแล้วพูดตามนะครับ',
      advanceQuestionEn: 'Say a short family sentence.',
      withPraise: true,
      stem: 'This is my...',
      expectedSpeech: 'This is my father.',
      options: [
        { emoji: '👆', label: 'This is my...', speak: 'This is my father.' },
        { emoji: '🔢', label: 'I have...', speak: 'I have one brother.' },
      ],
    },
  },

  numbers: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนตัวเลข 0–20 กันครับ 🔢 เลข 3 อ่านว่า three — ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'three',
      options: [{ emoji: '3️⃣', label: 'three', speak: 'three' }],
    },
    2: {
      textEn:
        'เก่งมากครับ! เลข 8 อ่านว่า eight ⏰ ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'eight',
      options: [{ emoji: '8️⃣', label: 'eight', speak: 'eight' }],
    },
    3: {
      textEn: 'เลข 7 อ่านว่าอะไรครับ? 7️⃣',
      withPraise: true,
      stem: 'seven',
      expectedSpeech: 'seven',
      options: [
        { emoji: '5️⃣', label: 'five', speak: 'five' },
        { emoji: '7️⃣', label: 'seven', speak: 'seven' },
        { emoji: '3️⃣', label: 'three', speak: 'three' },
        { emoji: '9️⃣', label: 'nine', speak: 'nine' },
      ],
    },
    4: {
      textEn:
        'ต่อไปเลข 11–19 ส่วนใหญ่ลงท้าย -teen ครับ เลข 16 อ่านว่า sixteen 🔢 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'sixteen',
      options: [{ emoji: '🔢', label: 'sixteen', speak: 'sixteen' }],
    },
    5: {
      textEn: 'เลข 20 อ่านว่าอะไรครับ? 2️⃣0️⃣',
      advanceQuestionEn: 'How do you say twenty?',
      withPraise: true,
      stem: 'twenty',
      expectedSpeech: 'twenty',
      options: [{ emoji: '2️⃣0️⃣', label: 'twenty', speak: 'twenty' }],
    },
  },

  telling_time: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกเวลาเป็นภาษาอังกฤษครับ ⏰ 6:00 อ่านว่า It\'s six o\'clock — ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "It's six o'clock.",
      options: [
        { emoji: '🕕', label: "six o'clock", speak: "It's six o'clock." },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! 7:30 อ่านว่า It\'s seven thirty 🕢 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's seven thirty.",
      options: [
        { emoji: '🕢', label: 'seven thirty', speak: "It's seven thirty." },
      ],
    },
    3: {
      textEn:
        'ตอนเช้าใช้ a.m. — It\'s seven a.m. 🌅 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's seven a.m.",
      options: [
        { emoji: '🌅', label: 'seven a.m.', speak: "It's seven a.m." },
        { emoji: '🌙', label: 'nine p.m.', speak: "It's nine p.m." },
      ],
    },
    4: {
      textEn: '9:00 ตอนเย็น อ่านว่าอะไรครับ? 🌙',
      withPraise: true,
      stem: "It's nine p.m.",
      expectedSpeech: "It's nine p.m.",
      options: [
        { emoji: '🕕', label: "six o'clock", speak: "It's six o'clock." },
        { emoji: '🕢', label: 'seven thirty', speak: "It's seven thirty." },
        { emoji: '🌅', label: 'seven a.m.', speak: "It's seven a.m." },
        { emoji: '🌙', label: 'nine p.m.', speak: "It's nine p.m." },
      ],
    },
    5: {
      textEn: 'ลองบอกเวลาที่คุณตื่นเป็นภาษาอังกฤษครับ ⏰',
      advanceQuestionEn: 'What time do you wake up?',
      withPraise: true,
      stem: "It's seven a.m.",
      expectedSpeech: "It's seven a.m.",
      options: [
        { emoji: '🌅', label: 'seven a.m.', speak: "It's seven a.m." },
      ],
    },
  },

  everyday_numbers: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนตัวเลข 20–100 กันครับ 🔢 เลข 40 อ่านว่า forty — ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'forty',
      options: [{ emoji: '4️⃣0️⃣', label: 'forty', speak: 'forty' }],
    },
    2: {
      textEn:
        'เก่งมากครับ! เลข 35 อ่านว่า thirty-five (สามสิบห้า) 🎯 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'thirty-five',
      options: [
        { emoji: '🎯', label: 'thirty-five', speak: 'thirty-five' },
      ],
    },
    3: {
      textEn: 'เลข 62 อ่านว่าอะไรครับ? 🔢',
      withPraise: true,
      stem: 'sixty-two',
      expectedSpeech: 'sixty-two',
      options: [
        { emoji: '🎯', label: 'forty', speak: 'forty' },
        { emoji: '🏀', label: 'fifty', speak: 'fifty' },
        { emoji: '🎲', label: 'sixty-two', speak: 'sixty-two' },
        { emoji: '🎳', label: 'seventy', speak: 'seventy' },
      ],
    },
    4: {
      textEn:
        'ระวัง thirteen (13) กับ thirty (30) ไม่เหมือนกันนะครับ 😊 เลข 50 อ่านว่า fifty — ลองพูดตาม',
      withPraise: true,
      stem: '',
      expectedSpeech: 'fifty',
      options: [{ emoji: '5️⃣0️⃣', label: 'fifty', speak: 'fifty' }],
    },
    5: {
      textEn: 'เลข 80 อ่านว่าอะไรครับ? 🔢',
      advanceQuestionEn: 'How do you say eighty?',
      withPraise: true,
      stem: 'eighty',
      expectedSpeech: 'eighty',
      options: [{ emoji: '8️⃣0️⃣', label: 'eighty', speak: 'eighty' }],
    },
  },

  money_prices: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนถามและบอกราคาเป็นภาษาอังกฤษครับ 💵 ถามราคาใช้ How much is it? — ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'How much is it?',
      options: [
        { emoji: '💬', label: 'How much is it?', speak: 'How much is it?' },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ตอบราคา — It\'s five dollars. 💵 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's five dollars.",
      options: [
        { emoji: '💵', label: "It's five dollars", speak: "It's five dollars." },
      ],
    },
    3: {
      textEn:
        'ถ้าราคาถูก ใช้ It\'s cheap. 👍 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's cheap.",
      options: [
        { emoji: '👍', label: "It's cheap", speak: "It's cheap." },
        { emoji: '💎', label: "It's expensive", speak: "It's expensive." },
      ],
    },
    4: {
      textEn:
        'ถ้าเห็นป้ายราคา $10 คุณจะพูดว่าอะไรครับ? 💵',
      withPraise: true,
      stem: "It's ten dollars.",
      expectedSpeech: "It's ten dollars.",
      options: [
        { emoji: '💬', label: 'How much is it?', speak: 'How much is it?' },
        { emoji: '💵', label: "It's ten dollars", speak: "It's ten dollars." },
        { emoji: '👍', label: "It's cheap", speak: "It's cheap." },
        { emoji: '💎', label: "It's expensive", speak: "It's expensive." },
      ],
    },
    5: {
      textEn:
        'ลองบอกราคาสินค้าที่คุณชอบซื้อเป็นภาษาอังกฤษครับ 🛒',
      advanceQuestionEn: 'Say a price in English.',
      withPraise: true,
      stem: "It's ten dollars.",
      expectedSpeech: "It's ten dollars.",
      options: [
        { emoji: '💵', label: "It's ten dollars", speak: "It's ten dollars." },
      ],
    },
  },

  likes_dislikes: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบครับ ☕ ถ้าชอบกาแฟ พูดว่า I like coffee. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I like coffee.',
      options: [
        { emoji: '☕', label: 'I like coffee', speak: 'I like coffee.' },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้าชอบพิซซ่า — I like pizza. 🍕 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I like pizza.',
      options: [
        { emoji: '🍕', label: 'I like pizza', speak: 'I like pizza.' },
      ],
    },
    3: {
      textEn:
        'ถ้าไม่ชอบชา ใช้ I don\'t like tea. 🍵 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I don't like tea.",
      options: [
        { emoji: '🍵', label: "I don't like tea", speak: "I don't like tea." },
      ],
    },
    4: {
      textEn:
        'ถ้ามีคนเสนอชาให้ แต่คุณไม่ชอบ จะพูดว่าอะไรครับ? 🍵',
      withPraise: true,
      stem: "I don't like tea.",
      expectedSpeech: "I don't like tea.",
      options: [
        { emoji: '☕', label: 'I like coffee', speak: 'I like coffee.' },
        { emoji: '🍕', label: 'I like pizza', speak: 'I like pizza.' },
        { emoji: '🍵', label: "I don't like tea", speak: "I don't like tea." },
      ],
    },
    5: {
      textEn:
        'ลองบอกสิ่งที่คุณชอบหรือไม่ชอบจริงๆ เป็นภาษาอังกฤษครับ 😊',
      advanceQuestionEn: 'What do you like or dislike?',
      withPraise: true,
      stem: 'I like...',
      expectedSpeech: 'I like coffee.',
      options: [
        { emoji: '☕', label: 'I like coffee', speak: 'I like coffee.' },
      ],
    },
  },

  wants_needs: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน I want / I need / I have ครับ 💧 ถ้าอยากได้น้ำ พูดว่า I want water. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I want water.',
      options: [
        { emoji: '💧', label: 'I want water', speak: 'I want water.' },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้าต้องการความช่วยเหลือ — I need help. 🆘 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I need help.',
      options: [
        { emoji: '🆘', label: 'I need help', speak: 'I need help.' },
      ],
    },
    3: {
      textEn:
        'บอกว่ามีอะไร — I have a dog. 🐕 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I have a dog.',
      options: [
        { emoji: '🐕', label: 'I have a dog', speak: 'I have a dog.' },
        { emoji: '🚗', label: 'I have a car', speak: 'I have a car.' },
      ],
    },
    4: {
      textEn:
        'ถ้าคุณกระหายน้ำ จะพูดว่าอะไรครับ? 💧',
      withPraise: true,
      stem: 'I want water.',
      expectedSpeech: 'I want water.',
      options: [
        { emoji: '💧', label: 'I want water', speak: 'I want water.' },
        { emoji: '🆘', label: 'I need help', speak: 'I need help.' },
        { emoji: '🐕', label: 'I have a dog', speak: 'I have a dog.' },
      ],
    },
    5: {
      textEn:
        'ลองพูดประโยคสั้นๆ ว่าคุณอยากได้ / ต้องการ / มีอะไรครับ 😊',
      advanceQuestionEn: 'Say what you want, need, or have.',
      withPraise: true,
      stem: 'I want...',
      expectedSpeech: 'I want coffee.',
      options: [
        { emoji: '☕', label: 'I want coffee', speak: 'I want coffee.' },
      ],
    },
  },

  can_cant: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน I can / I can\'t ครับ 🏊 ถ้าว่ายน้ำได้ พูดว่า I can swim. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I can swim.',
      options: [
        { emoji: '🏊', label: 'I can swim', speak: 'I can swim.' },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! ถ้าขับรถไม่ได้ — I can\'t drive. 🚗 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I can't drive.",
      options: [
        { emoji: '🚗', label: "I can't drive", speak: "I can't drive." },
      ],
    },
    3: {
      textEn:
        'ถ้าคุณทำอาหารได้ จะพูดว่าอะไรครับ? 🍳',
      withPraise: true,
      stem: 'I can cook.',
      expectedSpeech: 'I can cook.',
      options: [
        { emoji: '🏊', label: 'I can swim', speak: 'I can swim.' },
        { emoji: '🍳', label: 'I can cook', speak: 'I can cook.' },
        { emoji: '🚗', label: "I can't drive", speak: "I can't drive." },
      ],
    },
    4: {
      textEn:
        'ลองบอกความสามารถของคุณเป็นภาษาอังกฤษครับ 😊',
      advanceQuestionEn: 'What can or can\'t you do?',
      withPraise: true,
      stem: 'I can...',
      expectedSpeech: 'I can cook.',
      options: [
        { emoji: '🍳', label: 'I can cook', speak: 'I can cook.' },
      ],
    },
  },

  asking_for_help: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน 3 ประโยคช่วยชีวิตเวลาฟังอังกฤษไม่ทัน 🆘 อาวุธแรก — I don\'t understand. ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "I don't understand.",
      options: [
        {
          emoji: '🤷',
          label: "I don't understand",
          speak: "I don't understand.",
        },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! อาวุธที่สอง — ขอให้พูดช้าลง Can you speak more slowly? 🐢 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Can you speak more slowly?',
      options: [
        {
          emoji: '🐢',
          label: 'Speak more slowly',
          speak: 'Can you speak more slowly?',
        },
      ],
    },
    3: {
      textEn:
        'อาวุธที่สาม — ถามความหมาย What does that mean? ❓ ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'What does that mean?',
      options: [
        {
          emoji: '❓',
          label: 'What does that mean?',
          speak: 'What does that mean?',
        },
      ],
    },
    4: {
      textEn:
        'ถ้าฟังไม่เข้าใจเลย ควรพูดประโยคไหนครับ? 🤷',
      withPraise: true,
      stem: "I don't understand.",
      expectedSpeech: "I don't understand.",
      options: [
        {
          emoji: '🤷',
          label: "I don't understand",
          speak: "I don't understand.",
        },
        {
          emoji: '🐢',
          label: 'Speak more slowly',
          speak: 'Can you speak more slowly?',
        },
        {
          emoji: '❓',
          label: 'What does that mean?',
          speak: 'What does that mean?',
        },
      ],
    },
  },

  asking_questions: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนถามคำถมง่ายๆ ครับ 🚻 Where = สถานที่ — Where is the bathroom? ลองพูดตามนะครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Where is the bathroom?',
      options: [
        {
          emoji: '🚻',
          label: 'Where is the bathroom?',
          speak: 'Where is the bathroom?',
        },
      ],
    },
    2: {
      textEn:
        'เก่งมากครับ! Who = คน — Who is that? 👤 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Who is that?',
      options: [
        { emoji: '👤', label: 'Who is that?', speak: 'Who is that?' },
      ],
    },
    3: {
      textEn:
        'How = อย่างไร — How are you? 👋 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How are you?',
      options: [
        { emoji: '👋', label: 'How are you?', speak: 'How are you?' },
      ],
    },
    4: {
      textEn:
        'ถ้าอยากรู้ว่าสิ่งนี้คืออะไร จะถามว่าอะไรครับ? ❓',
      withPraise: true,
      stem: 'What is this?',
      expectedSpeech: 'What is this?',
      options: [
        { emoji: '❓', label: 'What is this?', speak: 'What is this?' },
        { emoji: '🚻', label: 'Where is the bathroom?', speak: 'Where is the bathroom?' },
        { emoji: '👤', label: 'Who is that?', speak: 'Who is that?' },
        { emoji: '👋', label: 'How are you?', speak: 'How are you?' },
      ],
    },
    5: {
      textEn:
        'ลองถามคำถามง่ายๆ ที่คุณใช้บ่อยเป็นภาษาอังกฤษครับ 😊',
      advanceQuestionEn: 'Ask a simple question in English.',
      withPraise: true,
      stem: 'What is this?',
      expectedSpeech: 'What is this?',
      options: [
        { emoji: '❓', label: 'What is this?', speak: 'What is this?' },
      ],
    },
  },
};

export const FOUNDATION_MAX_STEPS: Record<FoundationLessonId, number> = {
  introductions: 9,
  yes_no_maybe: 5,
  polite_expressions: 5,
  meet_people: 5,
  talk_about_groups: 5,
  ee_about_me_family: 9,
  numbers: 5,
  telling_time: 5,
  everyday_numbers: 5,
  money_prices: 5,
  likes_dislikes: 5,
  wants_needs: 5,
  can_cant: 4,
  asking_for_help: 4,
  asking_questions: 5,
};
