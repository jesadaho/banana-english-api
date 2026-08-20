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
  greetings: (step, text) =>
    loose(step, text, {
      1: /^hello$/,
      2: /^hi$/,
      3: /^hi$/,
      4: /^good morning$/,
      5: /^good afternoon$/,
      6: /^good evening$/,
      7: /^good morning$/,
      8: /^(hello|hi|good morning|good afternoon|good evening)$/,
    }),
  introductions: (step, text) =>
    loose(step, text, {
      1: /^my name is /,
      2: /^(my name is|i['']?m) /,
      3: /^nice to meet you$/,
      4: /^nice to meet you,? too$/,
      5: /^i['']?m from /,
      6: /^i live in /,
      7: /^(i work as|i['']?m a|i am a) /,
      8: /^(my name is|i['']?m) .+ (i['']?m from|i live in|i work as|i['']?m a|i am a) /,
    }),
  yes_no_maybe: (step, text) =>
    loose(step, text, {
      1: /^yes,? i do$/,
      2: /^yeah,? i do$|^yes,? i do$/,
      3: /^no,? i don['’]t$/,
      4: /^no,? i don['’]?t$/,
      5: /^maybe$/,
      6: /^maybe$|^i['’]?m not sure$/,
    }),
  polite_expressions: (step, text) =>
    loose(step, text, {
      1: /^(thank|thanks)/,
      2: /^you['']?re welcome$/,
      3: /^(excuse me|sorry|i['']?m sorry)$/,
    }),
  meet_people: (step, text) =>
    loose(step, text, {
      1: /^(i am|i['’]?m) new here$/,
      2: /^(i am|i['’]?m) excited$/,
      3: /^(you are|you['’]?re) my classmate$/,
      4: /^(you are|you['’]?re) very kind$/,
      5: /^(i am|i['’]?m) .+ (you are|you['’]?re) /,
    }),
  talk_about_groups: (step, text) =>
    loose(step, text, {
      1: /^(he is|he['’]?s) my classmate$/,
      2: /^(she is|she['’]?s) my teacher$/,
      3: /^(it is|it['’]?s) my bag$/,
      4: /^(she is|she['’]?s) very kind$/,
      5: /^(he is|he['’]?s) very kind (it is|it['’]?s) new$/,
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
      1: /^four$/,
      2: /^seven$/,
      3: /^fourteen$/,
      4: /^twenty$/,
      5: /^twelve$/,
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
      1: /^forty$/,
      2: /^fifty$/,
      3: /^eighty$/,
      4: /^seventy$/,
      5: /^thirty[- ]five$/,
      6: /^sixty[- ]two$/,
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

/** Structural close-miss (missing function words) — defer as close out pool. */
export const FOUNDATION_CLOSE_MATCHERS: Partial<
  Record<FoundationLessonId, (step: number, text: string) => boolean>
> = {
  greetings: (step, text) =>
    loose(step, text, {
      1: /^helo$/,
      2: /^hii$/,
      3: /^hii$/,
      4: /^(morning|good mornin)$/,
      5: /^(afternoon|good after)$/,
      6: /^(evening|good evenin)$/,
      7: /^(morning|good mornin)$/,
      8: /^(helo|hii|good mornin|good after|good evenin)$/,
    }),
  polite_expressions: (step, text) => loose(step, text, {
    1: /^thank you very$/, 2: /^you welcome$/, 3: /^excuse$/, 4: /^thank$/, 5: /^i sorry$/,
  }),
  meet_people: (step, text) => loose(step, text, {
    1: /^i new here$/,
    2: /^i excited$/,
    3: /^you my classmate$/,
    4: /^you very kind$/,
    5: /^i new here,? you my classmate$/,
  }),
  talk_about_groups: (step, text) => loose(step, text, {
    1: /^he my classmate$/,
    2: /^she my teacher$/,
    3: /^it my bag$/,
    4: /^she very kind$/,
    5: /^he very kind,? it new$/,
  }),
  ee_about_me_family: (step, text) => loose(step, text, {
    1: /^brotha$/, 2: /^motha$/, 3: /^fatha$/, 4: /^this my father$/,
    5: /^this my sister$/, 6: /^i have brother$/,
    7: /^i have two sister$/, 8: /^this my father$/,
  }),
  numbers: (step, text) => loose(step, text, {
    1: /^for$/,
    2: /^seben$/,
    3: /^four teen$/,
    4: /^twentee$/,
    5: /^twelb$/,
  }),
  telling_time: (step, text) => loose(step, text, {
    1: /^it['’]?s six clock$/, 2: /^it['’]?s seven thirty clock$/,
    3: /^it['’]?s seven$/, 4: /^it['’]?s nine$/, 5: /^it['’]?s seven morning$/,
  }),
  everyday_numbers: (step, text) => loose(step, text, {
    1: /^fourty$/,
    2: /^fivty$/,
    3: /^eightty$/,
    4: /^sebenty$/,
    5: /^thirty fiv$/,
    6: /^sixty tw$/,
  }),
  money_prices: (step, text) => loose(step, text, {
    1: /^how much it is$/, 2: /^it five dollars$/, 3: /^it cheap$/,
    4: /^it ten dollars$/, 5: /^it ten dollars$/,
  }),
  likes_dislikes: (step, text) => loose(step, text, {
    1: /^i like coffee very$/, 2: /^i like pizza very$/, 3: /^i no like tea$/,
    4: /^i no like tea$/, 5: /^i like coffee very$/,
  }),
  wants_needs: (step, text) => loose(step, text, {
    1: /^i want waters$/, 2: /^i need helps$/, 3: /^i have dog$/,
    4: /^i want waters$/, 5: /^i want coffees$/,
  }),
  can_cant: (step, text) => loose(step, text, {
    1: /^i swim$/, 2: /^i no can drive$/, 3: /^i can cooking$/, 4: /^i can cooking$/,
  }),
  asking_for_help: (step, text) => loose(step, text, {
    1: /^i not understand$/, 2: /^can speak more slowly$/,
    3: /^what that mean$/, 4: /^i not understand$/,
  }),
  asking_questions: (step, text) => loose(step, text, {
    1: /^where the bathroom$/, 2: /^who that$/, 3: /^how you$/,
    4: /^what this$/, 5: /^what this$/,
  }),
  introductions: (step, text) =>
    loose(step, text, {
      1: /^my name [a-z]+$/,
      2: /^i [a-z]+$|^my name [a-z]+$/,
      3: /^nice meet you$/,
      4: /^nice to meet too$/,
      5: /^i from /,
      6: /^i live [a-z]+$/,
      7: /^i work (?!as\b)/,
      8: /^my name [a-z]+.*i from /,
    }),
  yes_no_maybe: (step, text) =>
    loose(step, text, {
      1: /^yeah,? i do$/,
      2: /^yes i$/,
      3: /^no,? i dont$/,
      4: /^no i$/,
      5: /^(maybee|meybe|may be)$/,
      6: /^(maybee|meybe|may be)$/,
    }),
};

export const FOUNDATION_BOARDS: Record<
  FoundationLessonId,
  Record<number, ForcedGuidedBoard>
> = {
  greetings: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนการทักทายกันครับ — Hello, Hi และทักทายตามเวลาในวัน 😊 เริ่มจากคำแรก: Hello! ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Hello',
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “Hello” ครับ',
      options: [{ emoji: '👋', label: 'Hello', speak: 'Hello' }],
    },
    2: {
      textEn:
        'Hello ใช้ทักทายได้ทั่วไปครับ 👋 ต่อไปคำสบายๆ: Hi! ลองพูดตามว่า “Hi” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Hi',
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “Hi” ครับ',
      options: [{ emoji: '✌️', label: 'Hi', speak: 'Hi' }],
    },
    3: {
      textEn:
        'Hello ใช้ทักทายได้ทั่วไป ส่วน Hi ฟังสบายๆ และเป็นกันเองกว่าครับ ✌️ ถ้าเจอเพื่อนสนิท ควรทักว่าอะไรครับ?',
      withPraise: false,
      stem: 'เพื่อนสนิท → ทักว่าอะไร?',
      expectedSpeech: 'Hi',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าเจอเพื่อนสนิท ให้ตอบว่า “Hi” ครับ',
      options: [
        { emoji: '👋', label: 'Hello', speak: 'Hello' },
        { emoji: '✌️', label: 'Hi', speak: 'Hi' },
      ],
    },
    4: {
      textEn:
        'ช่วงเช้าใช้ Good morning. 🌅 ลองพูดตามว่า “Good morning” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Good morning',
      incorrectHintTh:
        'ยังไม่ถูกครับ ลองพูดตามว่า “Good morning” ครับ',
      options: [
        { emoji: '🌅', label: 'Good morning', speak: 'Good morning' },
      ],
    },
    5: {
      textEn:
        'ส่วนช่วงบ่ายเราใช้ Good afternoon. ☀️ สมมติว่าตอนนี้บ่าย 2 โมง คุณจะทักครูว่าอะไรครับ?',
      withPraise: false,
      stem: 'บ่าย 2 โมง → ทักว่าอะไร?',
      expectedSpeech: 'Good afternoon',
      incorrectHintTh:
        'ยังไม่ตรงครับ ตอนบ่ายให้ตอบว่า “Good afternoon” ครับ',
      options: [
        { emoji: '☀️', label: 'Good afternoon', speak: 'Good afternoon' },
        { emoji: '🌅', label: 'Good morning', speak: 'Good morning' },
      ],
    },
    6: {
      textEn:
        'ช่วงเย็นใช้ Good evening. เป็นคำทักทายครับ 🌙 ลองพูดตามว่า “Good evening” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Good evening',
      incorrectHintTh:
        'ยังไม่ถูกครับ ลองพูดตามว่า “Good evening” ครับ',
      options: [
        { emoji: '🌙', label: 'Good evening', speak: 'Good evening' },
      ],
    },
    7: {
      textEn:
        'เช้า 7 โมง ควรทักว่าอะไรครับ? เลือกแล้วพูดทักทายผ่านไมค์ได้เลย 🕖',
      withPraise: false,
      stem: '7 โมงเช้า → ทักว่าอะไร?',
      expectedSpeech: 'Good morning',
      incorrectHintTh:
        'ยังไม่ตรงครับ เวลา 7 โมงเช้าให้ตอบว่า “Good morning” ครับ',
      options: [
        { emoji: '🌅', label: 'Good morning', speak: 'Good morning' },
        { emoji: '☀️', label: 'Good afternoon', speak: 'Good afternoon' },
        { emoji: '🌙', label: 'Good evening', speak: 'Good evening' },
      ],
    },
    8: {
      textEn:
        'คราวนี้ลองทักทายผมสักประโยค — ใช้ Hello, Hi หรือคำทักทายตามเวลาที่เรียนไปก็ได้ครับ 👋',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Hello',
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองทักทายด้วย “Hello”, “Hi” หรือคำทักทายตามเวลาครับ',
      options: [
        { emoji: '👋', label: 'Hello', speak: 'Hello' },
        { emoji: '✌️', label: 'Hi', speak: 'Hi' },
        { emoji: '🌅', label: 'Good morning', speak: 'Good morning' },
      ],
    },
  },
  introductions: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกแนะนำตัวครับ 📝 My name is {name}. แปลว่า “ฉันชื่อ {name}” และพูดแบบสั้นว่า I\'m {name}. ได้ ใช้สองแบบนี้เพื่อบอกชื่อของเรา ลองพูดตามว่า “My name is {name}.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'My name is {name}.',
      options: [{ emoji: '📝', label: 'My name is', speak: 'My name is {name}.' }],
    },
    2: {
      textEn:
        'My name is {name}. แปลว่า “ฉันชื่อ {name}” และแบบสั้นคือ I\'m {name}. ทีนี้ลองใช้แบบสั้นในสถานการณ์จริงครับ ช่วยบอกครูหน่อยว่าคุณชื่ออะไร?',
      withPraise: false,
      stem: '',
      expectedSpeech: "I'm {name}.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองใช้ “My name is...” หรือ “I\'m...” แล้วตามด้วยชื่อของคุณครับ',
      options: [
        { emoji: '📝', label: 'My name is', speak: 'My name is {name}.' },
        { emoji: '💬', label: "I'm", speak: "I'm {name}." },
      ],
    },
    3: {
      textEn:
        'ต่อไปเวลาเจอคนใหม่ เราพูดว่า Nice to meet you. แปลว่า “ยินดีที่ได้รู้จัก” ลองพูดตามว่า “Nice to meet you.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Nice to meet you.',
      options: [
        { emoji: '🤝', label: 'Nice to meet you', speak: 'Nice to meet you.' },
      ],
    },
    4: {
      textEn:
        'ถ้าครูพูดว่า Nice to meet you. ให้ตอบว่า Nice to meet you too. แปลว่า “ยินดีที่ได้รู้จักเช่นกัน” ลองตอบเหมือนสถานการณ์จริงนะครับ: Nice to meet you.',
      advanceQuestionEn: 'Nice to meet you too.',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Nice to meet you too.',
      options: [
        {
          emoji: '😊',
          label: 'Nice to meet you too',
          speak: 'Nice to meet you too.',
        },
        { emoji: '🙏', label: 'Thank you', speak: 'Thank you.' },
      ],
    },
    5: {
      textEn:
        'ต่อไปมาฝึกบอกว่าคุณมาจากไหนครับ I\'m from Thailand. แปลว่า “ฉันมาจากประเทศไทย” ลองพูดตามว่า “I\'m from Thailand.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "I'm from Thailand.",
      options: [
        { emoji: '🇹🇭', label: 'Thailand', speak: "I'm from Thailand." },
      ],
    },
    6: {
      textEn:
        'I\'m from ใช้บอกว่ามาจากไหน ส่วน I live in ใช้บอกว่าตอนนี้อยู่ที่ไหน เช่น I live in Bangkok. แปลว่า “ฉันอยู่ที่กรุงเทพ” ช่วยบอกครูหน่อยครับว่าคุณอยู่ที่ไหน?',
      withPraise: false,
      stem: 'I live in...',
      expectedSpeech: 'I live in Bangkok.',
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองใช้ “I live in...” แล้วตามด้วยชื่อเมืองที่คุณอยู่ครับ',
      options: [
        { emoji: '🏙️', label: 'Bangkok', speak: 'I live in Bangkok.' },
        { emoji: '🌆', label: 'Chiang Mai', speak: 'I live in Chiang Mai.' },
        { emoji: '🌊', label: 'Phuket', speak: 'I live in Phuket.' },
      ],
    },
    7: {
      textEn:
        'ถ้าจะบอกงานหรือสิ่งที่ทำ พูดได้ว่า I work as a teacher. แปลว่า “ฉันทำงานเป็นครู” ช่วยบอกครูหน่อยครับว่าคุณทำอะไร?',
      withPraise: false,
      stem: "I work as... / I'm...",
      expectedSpeech: 'I work as a teacher.',
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองใช้ “I work as a...” หรือถ้าเป็นนักเรียน/นักศึกษา พูดว่า “I\'m a student.” ครับ',
      options: [
        {
          emoji: '👩‍🏫',
          label: 'Teacher',
          speak: 'I work as a teacher.',
        },
        { emoji: '🎓', label: 'Student', speak: "I'm a student." },
        {
          emoji: '💼',
          label: 'Office worker',
          speak: 'I work as an office worker.',
        },
      ],
    },
    8: {
      textEn:
        'ขั้นตอนสุดท้ายครับ ลองแนะนำตัวสั้นๆ เป็นภาษาอังกฤษด้วยชื่อ และอีกหนึ่งอย่างเกี่ยวกับตัวคุณ จะบอกว่ามาจากไหน อยู่ที่ไหน หรือทำงานอะไรก็ได้ครับ',
      withPraise: false,
      stem: 'My name is...',
      expectedSpeech: "My name is {name}. I'm from Thailand.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองเริ่มด้วย “I\'m {name}.” แล้วเพิ่มอีกหนึ่งอย่าง เช่น “I\'m from...”, “I live in...” หรือ “I work as...” ครับ',
      options: [],
    },
  },

  yes_no_maybe: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกตอบ Yes, No และ Maybe ครับ ✅ ถ้ามีคนถาม Do you like coffee? แปลว่า “คุณชอบกาแฟไหม” และเราชอบ ให้ตอบ Yes, I do. แปลว่า “ใช่ ฉันชอบ” ลองพูดตามว่า “Yes, I do.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Yes, I do.',
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “Yes, I do.” ครับ',
      options: [{ emoji: '✅', label: 'Yes, I do', speak: 'Yes, I do.' }],
    },
    2: {
      textEn:
        'ทีนี้ลองใช้จริงครับ — Do you like pizza? 🍕 ถ้าคุณชอบ ให้ตอบว่าอะไรครับ?',
      advanceQuestionEn: 'Do you like pizza?',
      withPraise: false,
      stem: 'Yes, I do.',
      expectedSpeech: 'Yes, I do.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าคุณชอบ ให้ตอบว่า “Yes, I do.” ครับ',
      options: [
        { emoji: '✅', label: 'Yes, I do', speak: 'Yes, I do.' },
        { emoji: '👍', label: 'Yes', speak: 'Yes.' },
      ],
    },
    3: {
      textEn:
        'ต่อไป No, I don\'t. แปลว่า “ไม่ ฉันไม่ชอบ” ใช้ตอบเมื่อคำตอบเป็นปฏิเสธ เช่น Do you like rain? — No, I don\'t. ลองพูดตามว่า “No, I don\'t.” ครับ ❌',
      withPraise: false,
      stem: '',
      expectedSpeech: "No, I don't.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “No, I don\'t.” ครับ',
      options: [
        { emoji: '❌', label: "No, I don't", speak: "No, I don't." },
      ],
    },
    4: {
      textEn:
        'ลองใช้ No จริงครับ — Do you like rain? 🌧️ ถ้าคุณไม่ชอบ ให้ตอบว่าอะไรครับ?',
      advanceQuestionEn: 'Do you like rain?',
      withPraise: false,
      stem: "No, I don't.",
      expectedSpeech: "No, I don't.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ถ้าคุณไม่ชอบ ให้ตอบว่า “No, I don\'t.” ครับ',
      options: [
        { emoji: '❌', label: "No, I don't", speak: "No, I don't." },
        { emoji: '👎', label: 'No', speak: 'No.' },
      ],
    },
    5: {
      textEn:
        'สุดท้าย Maybe แปลว่า “อาจจะ” ใช้เมื่อเรายังไม่แน่ใจ เช่น Are you free tomorrow? — Maybe. ลองพูดตามว่า “Maybe.” ครับ 🤔',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Maybe.',
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “Maybe.” ครับ',
      options: [{ emoji: '🤔', label: 'Maybe', speak: 'Maybe.' }],
    },
    6: {
      textEn:
        'ลองใช้ Maybe จริงครับ — Are you free tomorrow? 📅 ถ้ายังไม่แน่ใจ ให้ตอบว่าอะไรครับ?',
      advanceQuestionEn: 'Are you free tomorrow?',
      withPraise: false,
      stem: 'Maybe.',
      expectedSpeech: 'Maybe.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้ายังไม่แน่ใจ ให้ตอบว่า “Maybe.” ครับ',
      options: [
        { emoji: '🤔', label: 'Maybe', speak: 'Maybe.' },
        { emoji: '💭', label: "I'm not sure", speak: "I'm not sure." },
      ],
    },
  },

  polite_expressions: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนคำสุภาพที่ใช้ทุกวันครับ 🙏 Thank you very much. แปลว่า “ขอบคุณมาก” ใช้เมื่ออยากขอบคุณใคร ลองพูดตามว่า “Thank you very much.” ครับ',
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
        'ดีมากครับ! Thank you very much แปลว่า “ขอบคุณมาก” ถ้ามีคนขอบคุณเรา ให้ตอบว่า You\'re welcome 😊 ลองพูดตามนะครับ',
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
      ],
    },
    4: {
      textEn:
        'ถ้ามีคนช่วยคุณยกของหนัก คุณจะพูดว่าอะไรครับ? 🙏',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Thank you.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้ามีคนช่วย ให้พูดว่า “Thank you.” ครับ',
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
      stem: '',
      expectedSpeech: "I'm sorry.",
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าเดินชนคนโดยไม่ตั้งใจ ให้พูดว่า “I\'m sorry.” หรือ “Sorry.” ครับ',
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
        'สวัสดีครับ {name}! วันนี้เป็นวันแรกในคลาสครับ 🙋 ถ้าเราเพิ่งมาใหม่ พูดว่า “I\'m new here.” แปลว่า “ฉันเพิ่งมาใหม่” โดย I\'m เป็นรูปสั้นของ I am ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "I'm new here.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “I\'m new here.” ครับ',
      options: [],
    },
    2: {
      textEn:
        'วันแรกในคลาส คุณรู้สึกตื่นเต้นครับ 😊 พูดว่า “I\'m excited.” แปลว่า “ฉันรู้สึกตื่นเต้น” ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm excited.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “I\'m excited.” ครับ',
      options: [],
    },
    3: {
      textEn:
        'คุณเจอ Ben ซึ่งเรียนห้องเดียวกับคุณครับ 👋 พูดว่า “You\'re my classmate.” แปลว่า “คุณเป็นเพื่อนร่วมชั้นของฉัน” โดย You\'re เป็นรูปสั้นของ You are ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "You're my classmate.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “You\'re my classmate.” ครับ',
      options: [],
    },
    4: {
      textEn:
        'Ben ช่วยคุณหาห้องเรียนครับ 😊 ถ้าจะบอกเขาว่า “คุณใจดีมาก” ควรพูดว่าอะไร?',
      withPraise: true,
      stem: '',
      expectedSpeech: "You're very kind.",
      incorrectHintTh: 'ยังไม่ตรงครับ เรากำลังพูดถึง Ben ลองเริ่มด้วย “You\'re...” ครับ',
      options: [
        { emoji: '😊', label: "You're very kind.", speak: "You're very kind." },
        { emoji: '🙋', label: "I'm new here.", speak: "I'm new here." },
        { emoji: '👋', label: "You're my classmate.", speak: "You're my classmate." },
      ],
    },
    5: {
      textEn:
        'ลองคุยกับ Ben จริงๆ ครับ 👋 Ben พูดว่า “Hi! I\'m Ben. I\'m new here.” ตอบสองประโยคสั้นๆ: บอกหนึ่งอย่างเกี่ยวกับตัวคุณด้วย I\'m... และพูดถึง Ben ด้วย You\'re... ครับ',
      advanceQuestionEn:
        'ตอบ Ben สองประโยคสั้นๆ โดยใช้ I\'m... และ You\'re... ครับ',
      withPraise: true,
      stem: "I'm... You're...",
      expectedSpeech: "I'm new here too. You're my classmate.",
      incorrectHintTh: 'ยังไม่ตรงครับ ลองพูดสองส่วน โดยเริ่มด้วย “I\'m...” แล้วตามด้วย “You\'re...” ครับ',
      options: [],
    },
  },

  talk_about_groups: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เราจะพูดถึงคนอื่นและสิ่งของครับ 👨 Ben เรียนห้องเดียวกับคุณ พูดว่า “He\'s my classmate.” โดย He\'s เป็นรูปสั้นของ He is ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "He's my classmate.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “He\'s my classmate.” ครับ',
      options: [],
    },
    2: {
      textEn:
        'Anna เป็นครูของคุณครับ 👩 พูดว่า “She\'s my teacher.” โดย She\'s เป็นรูปสั้นของ She is ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "She's my teacher.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “She\'s my teacher.” ครับ',
      options: [],
    },
    3: {
      textEn:
        'ถ้าพูดถึงสิ่งของ เราใช้ It ครับ 🎒 กระเป๋าใบนี้เป็นของคุณ พูดว่า “It\'s my bag.” โดย It\'s เป็นรูปสั้นของ It is ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's my bag.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “It\'s my bag.” ครับ',
      options: [],
    },
    4: {
      textEn:
        'Anna ช่วยคุณหาห้องเรียนครับ 👩😊 ถ้าจะบอกว่า “เธอใจดีมาก” ควรพูดว่าอะไร?',
      withPraise: true,
      stem: '',
      expectedSpeech: "She's very kind.",
      incorrectHintTh: 'ยังไม่ตรงครับ เรากำลังพูดถึง Anna ลองเริ่มด้วย “She\'s...” ครับ',
      options: [
        { emoji: '👨', label: "He's very kind.", speak: "He's very kind." },
        { emoji: '👩', label: "She's very kind.", speak: "She's very kind." },
        { emoji: '🎒', label: "It's very kind.", speak: "It's very kind." },
      ],
    },
    5: {
      textEn:
        'ขั้นตอนสุดท้ายครับ 😊 Ben ช่วยถือกระเป๋าให้คุณ และโทรศัพท์เครื่องนี้เป็นของใหม่ พูดสองประโยคว่า “เขาใจดีมาก” และ “มันใหม่” โดยใช้ He\'s... และ It\'s... ครับ',
      advanceQuestionEn:
        'พูดสองประโยคเกี่ยวกับ Ben และโทรศัพท์ โดยใช้ He\'s... และ It\'s... ครับ',
      withPraise: true,
      stem: "He's... It's...",
      expectedSpeech: "He's very kind. It's new.",
      incorrectHintTh: 'ยังไม่ตรงครับ ลองพูดสองส่วน โดยเริ่มด้วย “He\'s...” แล้วตามด้วย “It\'s...” ครับ',
      options: [],
    },
  },

  ee_about_me_family: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนคำศัพท์ครอบครัวครับ 👨‍👩‍👧 เริ่มจาก brother แปลว่า “พี่ชายหรือน้องชาย” ลองพูดตามว่า “brother” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'brother',
      options: [{ emoji: '👦', label: 'brother', speak: 'brother' }],
    },
    2: {
      textEn:
        'ต่อไป mother แปลว่า “แม่” 👩 และจำไว้อีกคำว่า father แปลว่า “พ่อ” รอบนี้ลองพูดตามคำว่า mother ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'mother',
      options: [{ emoji: '👩', label: 'mother', speak: 'mother' }],
    },
    3: {
      textEn: 'จากคำที่เพิ่งเรียน “พ่อ” ภาษาอังกฤษพูดว่าอะไรครับ? 👨',
      withPraise: true,
      stem: '',
      expectedSpeech: 'father',
      incorrectHintTh: 'ยังไม่ตรงครับ คำนี้ขึ้นต้นด้วยเสียง /f/ ครับ',
      options: [...FAMILY_VOCAB_OPTIONS],
    },
    4: {
      textEn:
        'เยี่ยมเลยครับ! แนะนำคนหนึ่งคน — This is my father. 👨 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'This is my father.',
      options: [
        { emoji: '👨', label: 'This is my father.', speak: 'This is my father.' },
      ],
    },
    5: {
      textEn:
        'ลองแนะนำคนในครอบครัวอีกคนครับ — This is my sister. 👧',
      withPraise: true,
      stem: 'This is my...',
      expectedSpeech: 'This is my sister.',
      options: [
        { emoji: '👧', label: 'This is my sister.', speak: 'This is my sister.' },
      ],
    },
    6: {
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
    7: {
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
    8: {
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
        'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 0–20 กันครับ 🔢 เริ่มจาก 0–5: 0 zero, 1 one, 2 two, 3 three, 4 four, 5 five มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
      ttsText:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกคำอ่านภาษาอังกฤษของตัวเลขศูนย์ถึงยี่สิบกันครับ 🔢 เลขศูนย์ถึงห้า ในภาษาอังกฤษอ่านว่า “zero, one, two, three, four, five” มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
      withPraise: false,
      stem: '',
      expectedSpeech: 'four',
      incorrectHintTh: 'ลองนับแอปเปิลอีกครั้งครับ',
      options: [
        { emoji: '0️⃣', label: 'zero', speak: 'zero' },
        { emoji: '3️⃣', label: 'three', speak: 'three' },
        { emoji: '4️⃣', label: 'four', speak: 'four' },
        { emoji: '5️⃣', label: 'five', speak: 'five' },
      ],
    },
    2: {
      textEn:
        'ต่อไป 6–10 ครับ: 6 six, 7 seven, 8 eight, 9 nine, 10 ten บัตรคิวของคุณคือหมายเลขอะไรครับ? 🎫 7',
      ttsText:
        'ต่อไปเลขหกถึงสิบ ในภาษาอังกฤษอ่านว่า “six, seven, eight, nine, ten” บัตรคิวของคุณคือหมายเลขเจ็ด อ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🎫',
      withPraise: false,
      stem: '',
      expectedSpeech: 'seven',
      incorrectHintTh: 'ยังไม่ตรงครับ คำอ่านภาษาอังกฤษของเลขเจ็ดขึ้นต้นด้วยเสียง /s/ ครับ',
      options: [
        { emoji: '6️⃣', label: 'six', speak: 'six' },
        { emoji: '7️⃣', label: 'seven', speak: 'seven' },
        { emoji: '9️⃣', label: 'nine', speak: 'nine' },
        { emoji: '🔟', label: 'ten', speak: 'ten' },
      ],
    },
    3: {
      textEn:
        'ต่อไป 11–15 ครับ: 11 eleven, 12 twelve, 13 thirteen, 14 fourteen, 15 fifteen ตั้งแต่ 13 จะเริ่มได้ยินเสียง -teen หมายเลขห้องนี้อ่านว่าอะไรครับ? 🚪 14',
      ttsText:
        'ต่อไปเลขสิบเอ็ดถึงสิบห้า ในภาษาอังกฤษอ่านว่า “eleven, twelve, thirteen, fourteen, fifteen” ตั้งแต่เลขสิบสามจะเริ่มได้ยินเสียง -teen หมายเลขห้องสิบสี่อ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🚪',
      withPraise: true,
      stem: '',
      expectedSpeech: 'fourteen',
      incorrectHintTh: 'เลขนี้ขึ้นต้นด้วย four และลงท้ายด้วยเสียง -teen ครับ',
      options: [
        { emoji: '1️⃣2️⃣', label: 'twelve', speak: 'twelve' },
        { emoji: '1️⃣3️⃣', label: 'thirteen', speak: 'thirteen' },
        { emoji: '1️⃣4️⃣', label: 'fourteen', speak: 'fourteen' },
        { emoji: '1️⃣5️⃣', label: 'fifteen', speak: 'fifteen' },
      ],
    },
    4: {
      textEn:
        'กลุ่มสุดท้ายครับ: 16 sixteen, 17 seventeen, 18 eighteen, 19 nineteen, 20 twenty ระวังว่า 20 ลงท้ายด้วยเสียง -ty รถเมล์สายนี้คือหมายเลขอะไรครับ? 🚌 20',
      ttsText:
        'กลุ่มสุดท้ายครับ เลขสิบหกถึงยี่สิบ ในภาษาอังกฤษอ่านว่า “sixteen, seventeen, eighteen, nineteen, twenty” ระวังว่า twenty ลงท้ายด้วยเสียง -ty รถเมล์สายนี้คือหมายเลขยี่สิบ อ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🚌',
      withPraise: true,
      stem: '',
      expectedSpeech: 'twenty',
      incorrectHintTh: 'คำนี้ลงท้ายด้วยเสียง -ty ครับ',
      options: [
        { emoji: '1️⃣6️⃣', label: 'sixteen', speak: 'sixteen' },
        { emoji: '1️⃣8️⃣', label: 'eighteen', speak: 'eighteen' },
        { emoji: '1️⃣9️⃣', label: 'nineteen', speak: 'nineteen' },
        { emoji: '2️⃣0️⃣', label: 'twenty', speak: 'twenty' },
      ],
    },
    5: {
      textEn: 'ขั้นตอนสุดท้ายครับ โดยไม่มีตัวเลือก หมายเลขล็อกเกอร์นี้อ่านว่าอะไร? 🔐 12',
      ttsText: 'ขั้นตอนสุดท้ายครับ โดยไม่มีตัวเลือก หมายเลขล็อกเกอร์สิบสองอ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🔐',
      advanceQuestionEn: 'หมายเลขล็อกเกอร์นี้อ่านว่าอะไรครับ? 🔐 12',
      withPraise: true,
      stem: '',
      expectedSpeech: 'twelve',
      incorrectHintTh: 'เลขสิบสองอ่านเป็นภาษาอังกฤษว่า “twelve” ครับ',
      options: [],
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
      stem: '',
      expectedSpeech: "It's nine p.m.",
      incorrectHintTh: 'ยังไม่ตรงครับ เวลา 9:00 ตอนเย็น ให้พูดว่า “It\'s nine p.m.” ครับ',
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
      stem: '',
      expectedSpeech: "It's seven a.m.",
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “It\'s...” แล้วตามด้วยเวลาที่คุณตื่นและ a.m. ครับ',
      options: [],
    },
  },

  everyday_numbers: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 20–100 กันครับ 🔢 เริ่มจาก 20 twenty, 30 thirty, 40 forty, 50 fifty ลองพูดตามคำว่า “forty” ครับ',
      ttsText:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลขยี่สิบถึงหนึ่งร้อยกันครับ 🔢 เริ่มจาก ยี่สิบ twenty, สามสิบ thirty, สี่สิบ forty และห้าสิบ fifty ลองพูดตามคำว่า “forty” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'forty',
      options: [{ emoji: '4️⃣0️⃣', label: 'forty', speak: 'forty' }],
    },
    2: {
      textEn: 'ป้ายราคานี้อ่านว่าเท่าไรครับ? 🏷️ 50',
      ttsText: 'ป้ายราคานี้เขียนว่าเลขห้าสิบ อ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🏷️',
      withPraise: true,
      stem: '',
      expectedSpeech: 'fifty',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขห้าสิบอ่านเป็นภาษาอังกฤษว่า “fifty” ครับ',
      options: [
        { emoji: '3️⃣0️⃣', label: 'thirty', speak: 'thirty' },
        { emoji: '4️⃣0️⃣', label: 'forty', speak: 'forty' },
        { emoji: '5️⃣0️⃣', label: 'fifty', speak: 'fifty' },
      ],
    },
    3: {
      textEn:
        'ต่อไป 60 sixty, 70 seventy, 80 eighty, 90 ninety และ 100 one hundred ครับ ลองพูดตามคำว่า “eighty” ครับ',
      ttsText:
        'ต่อไป หกสิบ sixty, เจ็ดสิบ seventy, แปดสิบ eighty, เก้าสิบ ninety และหนึ่งร้อย one hundred ครับ ลองพูดตามคำว่า “eighty” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'eighty',
      options: [{ emoji: '8️⃣0️⃣', label: 'eighty', speak: 'eighty' }],
    },
    4: {
      textEn: 'รถเมล์สายนี้คือหมายเลขอะไรครับ? 🚌 70',
      ttsText: 'รถเมล์สายนี้คือหมายเลขเจ็ดสิบ อ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🚌',
      withPraise: true,
      stem: '',
      expectedSpeech: 'seventy',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขเจ็ดสิบอ่านเป็นภาษาอังกฤษว่า “seventy” ครับ',
      options: [
        { emoji: '6️⃣0️⃣', label: 'sixty', speak: 'sixty' },
        { emoji: '7️⃣0️⃣', label: 'seventy', speak: 'seventy' },
        { emoji: '8️⃣0️⃣', label: 'eighty', speak: 'eighty' },
        { emoji: '9️⃣0️⃣', label: 'ninety', speak: 'ninety' },
      ],
    },
    5: {
      textEn:
        'เลขสองหลักประกอบจากหลักสิบและหลักหน่วยครับ เช่น 30 thirty กับ 5 five รวมเป็น 35 thirty-five ลองพูดตามว่า “thirty-five” ครับ',
      ttsText:
        'เลขสองหลักประกอบจากหลักสิบและหลักหน่วยครับ เช่น สามสิบ thirty กับ ห้า five รวมเป็น สามสิบห้า thirty-five ลองพูดตามว่า “thirty-five” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'thirty-five',
      options: [{ emoji: '3️⃣5️⃣', label: 'thirty-five', speak: 'thirty-five' }],
    },
    6: {
      textEn: 'ขั้นตอนสุดท้ายครับ หมายเลขห้องนี้อ่านว่าอะไร? 🚪 62',
      ttsText: 'ขั้นตอนสุดท้ายครับ หมายเลขห้องหกสิบสองอ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🚪',
      advanceQuestionEn: 'หมายเลขห้องนี้อ่านว่าอะไรครับ? 🚪 62',
      withPraise: true,
      stem: '',
      expectedSpeech: 'sixty-two',
      incorrectHintTh: 'ลองประกอบ หกสิบ sixty กับ สอง two เป็น “sixty-two” ครับ',
      options: [],
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
        'สมมติกาแฟราคา 1 ดอลลาร์ ซึ่งราคาถูก เราพูดว่า It\'s cheap. แปลว่า “มันราคาถูก” 👍 ลองพูดตามนะครับ',
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
      stem: '',
      expectedSpeech: "It's ten dollars.",
      incorrectHintTh: 'ยังไม่ตรงครับ เมื่อป้ายราคาเป็น $10 ให้พูดว่า “It\'s ten dollars.” ครับ',
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
      stem: '',
      expectedSpeech: "It's ten dollars.",
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “It\'s...” แล้วตามด้วยราคาและคำว่า dollars ครับ',
      options: [],
    },
  },

  likes_dislikes: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบและไม่ชอบครับ ☕ I like... แปลว่า “ฉันชอบ...” เช่น I like coffee. แปลว่า “ฉันชอบกาแฟ” ลองพูดตามว่า “I like coffee.” ครับ',
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
      stem: '',
      expectedSpeech: "I don't like tea.",
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าไม่ชอบชา ให้พูดว่า “I don\'t like tea.” ครับ',
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
      stem: '',
      expectedSpeech: 'I like coffee.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “I like...” หรือ “I don\'t like...” แล้วพูดต่อครับ',
      options: [],
    },
  },

  wants_needs: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน I want / I need / I have ครับ 💧 I want ใช้บอกสิ่งที่อยากได้, I need ใช้บอกสิ่งที่จำเป็นต้องใช้ และ I have ใช้บอกสิ่งที่มีอยู่แล้ว เริ่มจาก I want water. แปลว่า “ฉันอยากได้น้ำ” ลองพูดตามครับ',
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
      ],
    },
    4: {
      textEn:
        'ถ้าคุณกระหายน้ำ จะพูดว่าอะไรครับ? 💧',
      withPraise: true,
      stem: '',
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
      stem: '',
      expectedSpeech: 'I want coffee.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “I want...”, “I need...” หรือ “I have...” แล้วพูดต่อครับ',
      options: [],
    },
  },

  can_cant: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน I can / I can\'t ครับ 🏊 can แปลว่า “ทำได้” ส่วน can\'t แปลว่า “ทำไม่ได้” เช่น I can swim. คือ “ฉันว่ายน้ำได้” ลองพูดตามว่า “I can swim.” ครับ',
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
      stem: '',
      expectedSpeech: 'I can cook.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าทำอาหารได้ ให้พูดว่า “I can cook.” ครับ',
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
      stem: '',
      expectedSpeech: 'I can cook.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “I can...” หรือ “I can\'t...” แล้วพูดต่อครับ',
      options: [],
    },
  },

  asking_for_help: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียน 3 ประโยคช่วยชีวิตเวลาฟังอังกฤษไม่ทัน 🆘 I don\'t understand. แปลว่า “ฉันไม่เข้าใจ” ใช้เมื่อฟังแล้วไม่เข้าใจ ลองพูดตามว่า “I don\'t understand.” ครับ',
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
      stem: '',
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
        'สวัสดีครับ {name}! วันนี้เรามาเรียนถามคำถามง่ายๆ ครับ 🚻 Where ใช้ถามสถานที่ และ Where is the bathroom? แปลว่า “ห้องน้ำอยู่ที่ไหน” ใช้เมื่อต้องการหาห้องน้ำ ลองพูดตามครับ',
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
        'ดีมากครับ! Where is the bathroom? แปลว่า “ห้องน้ำอยู่ที่ไหน” ต่อไป ถ้าต้องการถามว่า “ใคร” เราใช้ Who ครับ — Who is that? 👤 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Who is that?',
      options: [
        { emoji: '👤', label: 'Who is that?', speak: 'Who is that?' },
      ],
    },
    3: {
      textEn:
        'เยี่ยมเลยครับ! Who is that? แปลว่า “คนนั้นคือใคร” ต่อไป ถ้าต้องการถามว่า “เป็นอย่างไร” เราใช้ How ครับ — How are you? 👋 ลองพูดตามนะครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How are you?',
      options: [
        { emoji: '👋', label: 'How are you?', speak: 'How are you?' },
      ],
    },
    4: {
      textEn:
        'ดีมากครับ! How are you? แปลว่า “คุณเป็นอย่างไรบ้าง” ถ้าอยากรู้ว่าสิ่งนี้คืออะไร จะถามว่าอะไรครับ? ❓',
      withPraise: true,
      stem: '',
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
      stem: '',
      expectedSpeech: 'What is this?',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มคำถามด้วย “What...”, “Where...”, “Who...” หรือ “How...” ครับ',
      options: [],
    },
  },
};

export const FOUNDATION_MAX_STEPS: Record<FoundationLessonId, number> = {
  greetings: 8,
  introductions: 8,
  yes_no_maybe: 6,
  polite_expressions: 5,
  meet_people: 5,
  talk_about_groups: 5,
  ee_about_me_family: 8,
  numbers: 5,
  telling_time: 5,
  everyday_numbers: 6,
  money_prices: 5,
  likes_dislikes: 5,
  wants_needs: 5,
  can_cant: 4,
  asking_for_help: 4,
  asking_questions: 5,
};
