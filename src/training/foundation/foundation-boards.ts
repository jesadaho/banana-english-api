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
  fnd_v2_how_do_you_feel: (step, text) =>
    loose(step, text, {
      1: /^(i am|i['’]?m) happy$/,
      2: /^(i am|i['’]?m) sad$/,
      3: /^(i am|i['’]?m) tired$/,
      4: /^(i am|i['’]?m) hungry$/,
      5: /^how do you feel$/,
      6: /^(i am|i['’]?m) (happy|sad|tired|hungry|thirsty|excited|okay|ok|fine|great|good|sleepy)$/,
    }),
  talk_about_groups: (step, text) =>
    loose(step, text, {
      1: /^(he is|he['’]?s) my classmate$/,
      2: /^(she is|she['’]?s) my teacher$/,
      3: /^(it is|it['’]?s) my bag$/,
      4: /^(she is|she['’]?s) very kind$/,
      5: /^(he is|he['’]?s) very kind (it is|it['’]?s) new$/,
    }),
  fnd_v2_we_they: (step, text) =>
    loose(step, text, {
      1: /^(we are|we['’]?re) friends$/,
      2: /^(we are|we['’]?re) students$/,
      3: /^(they are|they['’]?re) my friends$/,
      4: /^(they are|they['’]?re) students$/,
      5: /^(we are|we['’]?re) friends$/,
      6: /^(we are|we['’]?re) friends[.!]?\s*(and\s+)?(they are|they['’]?re) happy$/,
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
      3: /^eight$/,
      4: /^(zero|one|two|three|four|five|six|seven|eight|nine|ten)$/,
    }),
  fnd_v2_numbers_11_20: (step, text) =>
    loose(step, text, {
      1: /^twelve$/,
      2: /^fourteen$/,
      3: /^thirteen$/,
      4: /^eighteen$/,
      5: /^twenty$/,
    }),
  fnd_v2_say_it_again: (step, text) =>
    loose(step, text, {
      1: /^can you say that again$/,
      2: /^how do you say this in english$/,
      3: /^can you say that again$/,
      4: /^how do you say this in english$/,
      5: /^(can you say that again|can you speak more slowly|i don['’]?t understand|what does that mean|how do you say this in english)$/,
    }),
  fnd_v2_basic_colors: (step, text) =>
    loose(step, text, {
      1: /^red$/,
      2: /^blue$/,
      3: /^yellow$/,
      4: /^green$/,
      5: /^black$/,
      6: /^i like (red|blue|yellow|green|black)$/,
    }),
  fnd_v2_shop_things: (step, text) =>
    loose(step, text, {
      1: /^bag$/,
      2: /^shirt$/,
      3: /^shirt$/,
      4: /^shoes$/,
      5: /^hat$/,
      6: /^i want (?:a (?:bag|shirt|book|hat)|shoes)$/,
    }),
  fnd_v2_buying_something: (step, text) =>
    loose(step, text, {
      1: /^i want this$/,
      2: /^i want (some )?water$/,
      3: /^i want (the|a) blue bag$/,
      4: /^i['']?ll take it$/,
      5: /^that['']?s too expensive$/,
      6: /^i['']?ll take it$/,
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
      2: /^how much/,
      3: /^(it['']?s )?five dollars?$/,
      4: /^it['']?s five dollars?$/,
      5: /^it['']?s ten dollars?$/,
      6: /^how much/,
      7: /^(thank you|thanks)$/,
    }),
  likes_dislikes: (step, text) =>
    loose(step, text, {
      1: /^i like coffee$/,
      2: /^i like pizza$/,
      3: /^i don['']?t like tea$/,
      4: /^i like sushi$/,
      5: /^i like /,
    }),
  fnd_v2_daily_actions: (step, text) =>
    loose(step, text, {
      1: /^i wake up$/,
      2: /^i eat$/,
      3: /^i study$/,
      4: /^i work$/,
      5: /^i sleep$/,
      6: /^(?:i (?:wake up|eat|work|study|sleep)[.!]?\s*){2,}$/,
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
  fnd_v2_places_directions: (step, text) =>
    loose(step, text, {
      1: /^bathroom$/,
      2: /^where is the bathroom$/,
      3: /^where is the hotel$/,
      4: /^taxi$/,
      5: /^go straight$/,
      6: /^where is the station$/,
    }),
  fnd_v2_goodbye_closing: (step, text) =>
    loose(step, text, {
      1: /^goodbye$/,
      2: /^see you later$/,
      3: /^see you later$/,
      4: /^nice talking to you$/,
      5: /^(goodbye|see you later|nice talking to you|have a nice day)$/,
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
  fnd_v2_how_do_you_feel: (step, text) => loose(step, text, {
    1: /^(i happy|im happy|i'?m happi)$/,
    2: /^(i sad|im sad)$/,
    3: /^(i tired|im tired)$/,
    4: /^(i hungry|im hungry)$/,
    5: /^how you feel$/,
    6: /^(i|im|i'?m) (happy|sad|tired|hungry|thirsty)$/,
  }),
  talk_about_groups: (step, text) => loose(step, text, {
    1: /^he my classmate$/,
    2: /^she my teacher$/,
    3: /^it my bag$/,
    4: /^she very kind$/,
    5: /^he very kind,? it new$/,
  }),
  fnd_v2_we_they: (step, text) => loose(step, text, {
    1: /^(we friends|were friends)$/,
    2: /^(we students|were students)$/,
    3: /^(they my friends|theyre my friends)$/,
    4: /^(they students|theyre students)$/,
    5: /^(we friends|were friends)$/,
    6: /^(we|were) friends.*(they|theyre) happy$/,
  }),
  ee_about_me_family: (step, text) => loose(step, text, {
    1: /^brotha$/, 2: /^motha$/, 3: /^fatha$/, 4: /^this my father$/,
    5: /^this my sister$/, 6: /^i have brother$/,
    7: /^i have two sister$/, 8: /^this my father$/,
  }),
  numbers: (step, text) => loose(step, text, {
    1: /^for$/,
    2: /^seben$/,
    3: /^eit$/,
    4: /^eit$/,
  }),
  fnd_v2_numbers_11_20: (step, text) => loose(step, text, {
    1: /^twelb$/,
    2: /^four teen$/,
    3: /^thir teen$/,
    4: /^eigh teen$/,
    5: /^twentee$/,
  }),
  fnd_v2_say_it_again: (step, text) => loose(step, text, {
    1: /^can you say again$/,
    2: /^how you say this in english$/,
    3: /^can you say again$/,
    4: /^how you say this english$/,
    5: /^(can you say again|can you speak slowly|i don['’]?t understand|what that mean|how you say this in english)$/,
  }),
  fnd_v2_basic_colors: (step, text) => loose(step, text, {
    1: /^redd?$/, 2: /^blu$/, 3: /^yello$/, 4: /^gren$/, 5: /^blak$/,
    6: /^i like color (red|blue|yellow|green|black)$/,
  }),
  fnd_v2_shop_things: (step, text) => loose(step, text, {
    1: /^a bag$/, 2: /^a shirt$/, 3: /^a shirt$/, 4: /^shoe$/,
    5: /^a hat$/, 6: /^i want (?:bag|shirt|book|hat|shoe)$/,
  }),
  fnd_v2_buying_something: (step, text) => loose(step, text, {
    1: /^i want$/,
    2: /^i want waters?$/,
    3: /^i want blue bag$/,
    4: /^i take it$/,
    5: /^that too expensive$/,
    6: /^i take it$/,
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
    1: /^how much it is$/,
    2: /^how much it is$/,
    3: /^five dollar$/,
    4: /^it five dollars$/,
    5: /^it ten dollars$/,
    6: /^how much it is$/,
    7: /^thank$/,
  }),
  likes_dislikes: (step, text) => loose(step, text, {
    1: /^i like coffee very$/, 2: /^i like pizza very$/, 3: /^i no like tea$/,
    4: /^i like sushi very$/, 5: /^i like coffee very$/,
  }),
  fnd_v2_daily_actions: (step, text) => loose(step, text, {
    1: /^i wake$/, 2: /^i eating$/, 3: /^i studying$/, 4: /^i working$/,
    5: /^i sleeping$/, 6: /^i (?:wake|eating|working|studying|sleeping).+i (?:wake|eating|working|studying|sleeping)$/,
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
  fnd_v2_places_directions: (step, text) => loose(step, text, {
    1: /^bath room$/, 2: /^where the bathroom$/, 3: /^where the hotel$/,
    4: /^a taxi$/, 5: /^go straight ahead$/, 6: /^where the station$/,
  }),
  fnd_v2_goodbye_closing: (step, text) => loose(step, text, {
    1: /^good bye$/, 2: /^see later$/, 3: /^see later$/,
    4: /^nice talk to you$/, 5: /^(bye bye|see later|nice talk to you|have nice day)$/,
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

  fnd_v2_how_do_you_feel: {
    1: {
      textEn:
        'วันนี้เราจะฝึกบอกความรู้สึกครับ 😊 happy แปลว่า “มีความสุข” และ sad แปลว่า “เศร้า” 😢 ถ้ารู้สึกมีความสุขพูดว่า I\'m happy. ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "I'm happy.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “I\'m happy.” ครับ',
      options: [],
    },
    2: {
      textEn:
        'วันนี้ Max ทำของหายและรู้สึกเศร้า 😢 เขาจะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm sad.",
      incorrectHintTh: 'ยังไม่ตรงครับ หน้าตานี้กำลังเศร้า ลองใช้ I\'m... กับคำว่า sad ครับ',
      options: [
        { emoji: '😢', label: 'Sad', speak: "I'm sad." },
        { emoji: '😊', label: 'Happy', speak: "I'm happy." },
      ],
    },
    3: {
      textEn:
        'อีกสามความรู้สึกที่ใช้บ่อยครับ: tired คือเหนื่อย 😴 hungry คือหิว 🍽️ และ thirsty คือกระหายน้ำ 🥤 ถ้าเหนื่อยพูดว่า I\'m tired. ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm tired.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “I\'m tired.” ครับ',
      options: [],
    },
    4: {
      textEn:
        'คุณยังไม่ได้กินข้าวและตอนนี้หิวมาก 🍽️😋 คุณจะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'm hungry.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ถ้ายังไม่ได้กินข้าว เราพูดว่า I\'m hungry. ครับ',
      options: [
        { emoji: '🍽️😋', label: 'Hungry', speak: "I'm hungry." },
        { emoji: '🥤😓', label: 'Thirsty', speak: "I'm thirsty." },
        { emoji: '😴', label: 'Tired', speak: "I'm tired." },
      ],
    },
    5: {
      textEn:
        'ถ้าอยากถามเพื่อนว่าเขารู้สึกอย่างไร ให้ถามว่า How do you feel? แปลว่า “คุณรู้สึกอย่างไร” ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How do you feel?',
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “How do you feel?” ครับ',
      options: [],
    },
    6: {
      textEn:
        'How do you feel today? ลองตอบความรู้สึกจริงของคุณด้วย I\'m... ครับ',
      advanceQuestionEn: 'How do you feel today? Answer with I\'m...',
      withPraise: true,
      stem: "I'm...",
      expectedSpeech: "I'm happy.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองเริ่มด้วย I\'m... แล้วตามด้วยความรู้สึก เช่น I\'m happy. ครับ',
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

  fnd_v2_we_they: {
    1: {
      textEn:
        'ถ้าพูดถึงตัวเราและเพื่อนรวมกัน ใช้ we แปลว่า “พวกเรา” ครับ 👥 We are friends. หรือพูดสั้นว่า We\'re friends. ลองพูดตามว่า We\'re friends. ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: "We're friends.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “We\'re friends.” ครับ',
      options: [],
    },
    2: {
      textEn:
        'คุณกับเพื่อนเรียนอยู่ด้วยกัน 🎓🎓 ถ้าจะบอกว่า “พวกเราเป็นนักเรียน” คุณจะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: "We're students.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ประโยคพูดถึงตัวคุณรวมกับเพื่อน ให้เริ่มด้วย We\'re... ครับ',
      options: [
        { emoji: '🎓🎓', label: 'We are students', speak: "We're students." },
        { emoji: '🧑‍🤝‍🧑', label: 'We are friends', speak: "We're friends." },
      ],
    },
    3: {
      textEn:
        'ถ้าพูดถึงคนกลุ่มอื่นที่ไม่รวมตัวเรา ใช้ they แปลว่า “พวกเขา” ครับ 👉👥 They are my friends. หรือ They\'re my friends. ลองพูดตามว่า They\'re my friends. ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "They're my friends.",
      incorrectHintTh: 'ยังไม่ถูกครับ ลองพูดตามว่า “They\'re my friends.” ครับ',
      options: [],
    },
    4: {
      textEn:
        'คนกลุ่มนั้นเป็นนักเรียน 👉🎓🎓 คุณจะพูดถึงพวกเขาว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: "They're students.",
      incorrectHintTh:
        'ยังไม่ตรงครับ คุณกำลังพูดถึงคนกลุ่มอื่น ให้เริ่มด้วย They\'re... ครับ',
      options: [
        {
          emoji: '👉🎓🎓',
          label: 'They are students',
          speak: "They're students.",
        },
        {
          emoji: '👉👩‍🏫👨‍🏫',
          label: 'They are teachers',
          speak: "They're teachers.",
        },
      ],
    },
    5: {
      textEn:
        'คุณอยู่ในกลุ่มนี้และทุกคนเป็นเพื่อนกัน 🫵👥 ควรใช้ We หรือ They ครับ? ลองพูดประโยคเต็ม',
      withPraise: true,
      stem: '',
      expectedSpeech: "We're friends.",
      incorrectHintTh:
        'ยังไม่ตรงครับ กลุ่มนี้มีตัวคุณรวมอยู่ด้วย จึงใช้ We ครับ',
      options: [
        { emoji: '🫵👥', label: 'We', speak: "We're friends." },
        { emoji: '👉👥', label: 'They', speak: "They're friends." },
      ],
    },
    6: {
      textEn:
        'ขั้นตอนสุดท้ายครับ คุณกับ Ben เป็นเพื่อนกัน และคนกลุ่มโน้นกำลังมีความสุข ลองพูดสองประโยคว่า “พวกเราเป็นเพื่อนกัน พวกเขามีความสุข” ครับ 😊',
      advanceQuestionEn:
        'พูดสองประโยค: We\'re friends. และ They\'re happy.',
      withPraise: true,
      stem: "We're... They're...",
      expectedSpeech: "We're friends. They're happy.",
      incorrectHintTh:
        'ยังไม่ตรงครับ ใช้ We\'re... กับกลุ่มที่มีคุณ และ They\'re... กับคนกลุ่มอื่นครับ',
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
        'สวัสดีครับ {name}! วันนี้เราจะฝึกตัวเลข 0–10 กันครับ 🔢 เริ่มจาก 0–5: 0 zero, 1 one, 2 two, 3 three, 4 four, 5 five มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
      ttsText:
        'สวัสดีครับ {name}! วันนี้เราจะฝึกคำอ่านภาษาอังกฤษของตัวเลขศูนย์ถึงสิบกันครับ 🔢 เลขศูนย์อ่านว่า zero ส่วนเลขหนึ่งถึงห้าอ่านว่า “one, two, three, four, five” มีแอปเปิลกี่ลูกครับ? 🍎🍎🍎🍎',
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
      textEn: 'หมายเลขห้องนี้อ่านว่าอะไรครับ? 🚪 8',
      ttsText: 'หมายเลขห้องแปดอ่านเป็นภาษาอังกฤษว่าอะไรครับ? 🚪',
      withPraise: true,
      stem: '',
      expectedSpeech: 'eight',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขแปดอ่านเป็นภาษาอังกฤษว่า “eight” ครับ',
      options: [
        { emoji: '6️⃣', label: 'six', speak: 'six' },
        { emoji: '8️⃣', label: 'eight', speak: 'eight' },
        { emoji: '9️⃣', label: 'nine', speak: 'nine' },
        { emoji: '🔟', label: 'ten', speak: 'ten' },
      ],
    },
    4: {
      textEn:
        'ขั้นตอนสุดท้ายครับ เลขโปรดของคุณคืออะไร? ลองพูดเลขที่คุณชอบเป็นภาษาอังกฤษครับ — วันนี้ลองพูด eight ⭐',
      ttsText:
        'ขั้นตอนสุดท้ายครับ เลขโปรดของคุณคืออะไร? ลองพูดเลขที่คุณชอบเป็นภาษาอังกฤษครับ — วันนี้ลองพูด eight ⭐',
      withPraise: true,
      stem: '',
      expectedSpeech: 'eight',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองพูดเลขโปรดของคุณเป็นภาษาอังกฤษ เช่น “eight” ครับ',
      options: [
        { emoji: '3️⃣', label: 'three', speak: 'three' },
        { emoji: '5️⃣', label: 'five', speak: 'five' },
        { emoji: '8️⃣', label: 'eight', speak: 'eight' },
        { emoji: '🔟', label: 'ten', speak: 'ten' },
      ],
    },
  },

  fnd_v2_numbers_11_20: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้ไปต่อเลข 11 และ 12 ครับ: 11 eleven, 12 twelve 🔢 ลองพูดตามว่า “twelve” ครับ',
      ttsText:
        'สวัสดีครับ {name}! วันนี้ไปต่อเลขสิบเอ็ดและสิบสอง ในภาษาอังกฤษอ่านว่า “eleven, twelve” ลองพูดตามว่า “twelve” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'twelve',
      options: [],
    },
    2: {
      textEn:
        'ต่อไป 13 thirteen, 14 fourteen และ 15 fifteen ครับ ตั้งแต่ 13 จะได้ยินเสียง -teen หมายเลขห้องนี้อ่านว่าอะไรครับ? 🚪 14',
      ttsText:
        'ต่อไปเลขสิบสาม สิบสี่ และสิบห้า ในภาษาอังกฤษอ่านว่า “thirteen, fourteen, fifteen” ตั้งแต่เลขสิบสามจะได้ยินเสียง -teen หมายเลขห้องสิบสี่อ่านเป็นภาษาอังกฤษว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'fourteen',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขนี้ขึ้นต้นด้วย four และลงท้ายด้วยเสียง -teen ครับ',
      options: [
        { emoji: '1️⃣3️⃣', label: 'thirteen', speak: 'thirteen' },
        { emoji: '1️⃣4️⃣', label: 'fourteen', speak: 'fourteen' },
        { emoji: '1️⃣5️⃣', label: 'fifteen', speak: 'fifteen' },
      ],
    },
    3: {
      textEn: 'ห้องถัดไปคือหมายเลขอะไรครับ? 🚪 13',
      ttsText: 'ห้องถัดไปคือหมายเลขสิบสาม อ่านเป็นภาษาอังกฤษว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'thirteen',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขสิบสามอ่านเป็นภาษาอังกฤษว่า “thirteen” ครับ',
      options: [
        { emoji: '1️⃣2️⃣', label: 'twelve', speak: 'twelve' },
        { emoji: '1️⃣3️⃣', label: 'thirteen', speak: 'thirteen' },
        { emoji: '1️⃣4️⃣', label: 'fourteen', speak: 'fourteen' },
      ],
    },
    4: {
      textEn: 'กลุ่มสุดท้ายครับ: 16 sixteen, 17 seventeen, 18 eighteen และ 19 nineteen 📦 ลองอ่านเลข 18 ครับ',
      ttsText: 'กลุ่มสุดท้าย เลขสิบหกถึงสิบเก้า ในภาษาอังกฤษอ่านว่า “sixteen, seventeen, eighteen, nineteen” ลองอ่านเลขสิบแปดครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'eighteen',
      incorrectHintTh: 'ยังไม่ตรงครับ เลขสิบแปดอ่านเป็นภาษาอังกฤษว่า “eighteen” ครับ',
      options: [
        { emoji: '1️⃣6️⃣', label: 'sixteen', speak: 'sixteen' },
        { emoji: '1️⃣7️⃣', label: 'seventeen', speak: 'seventeen' },
        { emoji: '1️⃣8️⃣', label: 'eighteen', speak: 'eighteen' },
        { emoji: '1️⃣9️⃣', label: 'nineteen', speak: 'nineteen' },
      ],
    },
    5: {
      textEn: 'เลข 20 อ่านว่า twenty ซึ่งลงท้ายด้วยเสียง -ty ครับ ขั้นตอนสุดท้าย โดยไม่มีตัวเลือก รถเมล์สายนี้อ่านว่าอะไร? 🚌 20',
      ttsText: 'เลขยี่สิบอ่านว่า “twenty” ซึ่งลงท้ายด้วยเสียง -ty ขั้นตอนสุดท้าย โดยไม่มีตัวเลือก รถเมล์สายยี่สิบอ่านเป็นภาษาอังกฤษว่าอะไรครับ?',
      advanceQuestionEn: 'รถเมล์สายนี้อ่านว่าอะไรครับ? 🚌 20',
      withPraise: true,
      stem: '',
      expectedSpeech: 'twenty',
      incorrectHintTh: 'เลขยี่สิบอ่านเป็นภาษาอังกฤษว่า “twenty” ครับ',
      options: [],
    },
  },

  fnd_v2_say_it_again: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนประโยคขอให้พูดอีกครั้งครับ 🔁 Can you say that again? แปลว่า “พูดอีกครั้งได้ไหม” คำว่า again แปลว่า “อีกครั้ง” ใช้เมื่อฟังไม่ทัน ลองพูดตามว่า “Can you say that again?” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Can you say that again?',
      options: [],
    },
    2: {
      textEn:
        'เก่งมากครับ! ต่อไปถามว่าพูดว่าอะไรเป็นภาษาอังกฤษ — How do you say this in English? 🇬🇧 คำว่า English แปลว่า “ภาษาอังกฤษ” ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How do you say this in English?',
      options: [],
    },
    3: {
      textEn:
        'ถ้าฟังไม่ทันและอยากให้พูดอีกครั้ง ควรพูดประโยคไหนครับ? 🔁',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Can you say that again?',
      options: [
        {
          emoji: '🔁',
          label: 'Can you say that again?',
          speak: 'Can you say that again?',
        },
        {
          emoji: '🇬🇧',
          label: 'How do you say this in English?',
          speak: 'How do you say this in English?',
        },
      ],
    },
    4: {
      textEn:
        'ถ้าชี้ไปที่ของแล้วอยากรู้ว่าพูดว่าอะไรเป็นภาษาอังกฤษ ควรพูดประโยคไหนครับ? 🇬🇧',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How do you say this in English?',
      options: [
        {
          emoji: '🔁',
          label: 'Can you say that again?',
          speak: 'Can you say that again?',
        },
        {
          emoji: '🇬🇧',
          label: 'How do you say this in English?',
          speak: 'How do you say this in English?',
        },
      ],
    },
    5: {
      textEn:
        'ขั้นตอนสุดท้ายครับ ตอนนี้ถ้าฟังภาษาอังกฤษไม่ทัน คุณช่วยตัวเองได้แล้ว 🆘 ลองเลือกพูดหนึ่งประโยคเพื่อขอให้ผมพูดซ้ำ พูดช้าลง บอกว่าไม่เข้าใจ หรือถามความหมายครับ',
      advanceQuestionEn:
        'ลองพูดหนึ่งประโยคเพื่อขอให้พูดซ้ำ พูดช้าลง บอกว่าไม่เข้าใจ หรือถามความหมายครับ 🆘',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Can you say that again?',
      incorrectHintTh:
        'ลองใช้หนึ่งในประโยคช่วยชีวิต เช่น “Can you say that again?” หรือ “I don\'t understand.” ครับ',
      options: [],
    },
  },

  fnd_v2_basic_colors: {
    1: {
      textEn:
        'วันนี้เราจะเรียนสีพื้นฐานกันครับ 🎨 red แปลว่า “สีแดง” และ blue แปลว่า “สีน้ำเงิน” ลองพูดตามว่า “red” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'red',
      options: [],
    },
    2: {
      textEn:
        'กระเป๋าใบนี้เป็นสีน้ำเงินครับ 🎒🔵 สีนี้ภาษาอังกฤษเรียกว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'blue',
      incorrectHintTh: 'ยังไม่ตรงครับ กระเป๋าใบนี้เป็นสีน้ำเงิน ลองพูดว่า “blue” ครับ',
      options: [
        { emoji: '🔵', label: 'Blue', speak: 'blue' },
        { emoji: '🔴', label: 'Red', speak: 'red' },
      ],
    },
    3: {
      textEn:
        'yellow แปลว่า “สีเหลือง” 🟡 green แปลว่า “สีเขียว” 🟢 ลองพูดตามว่า “yellow” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'yellow',
      options: [],
    },
    4: {
      textEn:
        'ใบไม้นี้เป็นสีเขียวครับ 🍃 สีเขียวภาษาอังกฤษพูดว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'green',
      incorrectHintTh: 'ยังไม่ตรงครับ ใบไม้นี้เป็นสีเขียว ลองพูดว่า “green” ครับ',
      options: [
        { emoji: '🟢', label: 'Green', speak: 'green' },
        { emoji: '🟡', label: 'Yellow', speak: 'yellow' },
        { emoji: '🔵', label: 'Blue', speak: 'blue' },
      ],
    },
    5: {
      textEn:
        'สีสุดท้ายคือ black แปลว่า “สีดำ” ⚫ ลองพูดตามว่า “black” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'black',
      options: [],
    },
    6: {
      textEn:
        'ขั้นตอนสุดท้ายครับ คุณชอบสีอะไร? เลือกหนึ่งสีแล้วพูดว่า I like... เช่น I like blue.',
      advanceQuestionEn: 'What color do you like? Answer with I like...',
      withPraise: true,
      stem: 'I like...',
      expectedSpeech: 'I like blue.',
      incorrectHintTh:
        'ยังไม่ตรงครับ ลองพูด “I like...” แล้วตามด้วย red, blue, yellow, green หรือ black ครับ',
      options: [],
    },
  },

  fnd_v2_shop_things: {
    1: {
      textEn:
        'วันนี้เราจะเรียนชื่อของในร้านครับ 🛍️ bag แปลว่า “กระเป๋า” ลองพูดตามว่า “bag” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'bag',
      options: [],
    },
    2: {
      textEn:
        'shirt แปลว่า “เสื้อเชิ้ต” 👕 ลองพูดตามว่า “shirt” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'shirt',
      options: [],
    },
    3: {
      textEn: 'คุณเห็นเสื้อเชิ้ตตัวนี้ 👕 ของชิ้นนี้เรียกว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'shirt',
      incorrectHintTh: 'ยังไม่ตรงครับ รูปนี้คือเสื้อเชิ้ต ลองพูดว่า “shirt” ครับ',
      options: [
        { emoji: '👕', label: 'Shirt', speak: 'shirt' },
        { emoji: '👜', label: 'Bag', speak: 'bag' },
      ],
    },
    4: {
      textEn:
        'อีกสองอย่างครับ book แปลว่า “หนังสือ” 📘 และ shoes แปลว่า “รองเท้า” 👟 ลองพูดตามว่า “shoes” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'shoes',
      options: [],
    },
    5: {
      textEn:
        'hat แปลว่า “หมวก” 🧢 ลองพูดตามว่า “hat” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'hat',
      options: [],
    },
    6: {
      textEn:
        'ขั้นตอนสุดท้ายครับ เลือกของหนึ่งอย่างที่คุณอยากได้: bag, shirt, book, shoes หรือ hat แล้วบอกพนักงานด้วย I want... ครับ',
      advanceQuestionEn: 'Choose one shop item and say I want...',
      withPraise: true,
      stem: 'I want...',
      expectedSpeech: 'I want a bag.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองพูดว่า “I want a...” แล้วตามด้วย bag, shirt, book หรือ hat ถ้าเลือก shoes ให้พูด “I want shoes.” ครับ',
      options: [],
    },
  },

  fnd_v2_buying_something: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนประโยคซื้อของครับ 🛍️ ถ้าอยากได้สิ่งนี้ พูดว่า I want this. แปลว่า “ฉันอยากได้สิ่งนี้” ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I want this.',
      options: [],
    },
    2: {
      textEn:
        'ตอนนี้คุณต้องการน้ำหนึ่งขวด 💧 จากโครง I want... คุณจะบอกพนักงานว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I want water.',
      incorrectHintTh: 'ยังไม่ตรงครับ เริ่มด้วย “I want...” แล้วตามด้วย water ครับ',
      options: [
        { emoji: '💧', label: 'Want water', speak: 'I want water.' },
        { emoji: '📘', label: 'Want a book', speak: 'I want a book.' },
        { emoji: '❓', label: 'Ask the price', speak: 'How much is it?' },
      ],
    },
    3: {
      textEn:
        'ถ้ามีกระเป๋าหลายใบและคุณต้องการใบสีฟ้า ให้พูดว่า I want the blue bag. 🟦👜 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I want the blue bag.',
      options: [],
    },
    4: {
      textEn:
        'ถ้าตัดสินใจซื้อแล้ว พูดว่า I\'ll take it. แปลว่า “ฉันเอาอันนี้” ✅ ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'll take it.",
      options: [],
    },
    5: {
      textEn:
        'กระเป๋าใบนี้ราคา 5,000 บาท 💸 คุณรู้สึกว่าแพงเกินไป พูดว่า That\'s too expensive. ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "That's too expensive.",
      incorrectHintTh: 'ยังไม่ตรงครับ ราคาแพงเกินไป ให้พูดว่า “That\'s too expensive.” ครับ',
      options: [
        {
          emoji: '💸',
            label: "That's too expensive",
            speak: "That's too expensive.",
        },
        { emoji: '👍', label: "It's cheap", speak: "It's cheap." },
        { emoji: '✅', label: "I'll take it", speak: "I'll take it." },
      ],
    },
    6: {
      textEn:
        'ขั้นตอนสุดท้ายครับ หนังสือเล่มนี้ราคา 20 บาท 📘 ราคาโอเคและคุณต้องการซื้อ คุณจะพูดปิดการซื้อว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: "I'll take it.",
      incorrectHintTh: 'ยังไม่ตรงครับ คุณรู้ราคาแล้วและต้องการซื้อ ให้พูดว่า “I\'ll take it.” ครับ',
      options: [
        { emoji: '✅', label: "I'll take it", speak: "I'll take it." },
        { emoji: '💸', label: "That's too expensive", speak: "That's too expensive." },
        { emoji: '❓', label: 'How much is it?', speak: 'How much is it?' },
      ],
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
        'สวัสดีครับ {name}! วันนี้เราจะฝึกถามและเข้าใจราคาครับ 💵 เวลาอยากรู้ราคา ให้ถามว่า How much is it? แปลว่า “ราคาเท่าไหร่” ลองพูดตามครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'How much is it?',
      options: [],
    },
    2: {
      textEn:
        'คุณเห็นกระเป๋าใบหนึ่งและอยากรู้ราคา 👜 คุณจะถามพนักงานว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How much is it?',
      options: [
        { emoji: '💰', label: 'Ask the price', speak: 'How much is it?' },
        { emoji: '👉', label: 'Want this', speak: 'I want this.' },
        { emoji: '🙏', label: 'Thank you', speak: 'Thank you.' },
      ],
    },
    3: {
      textEn:
        'พนักงานตอบราคาเป็นตัวเลขก่อน แล้วตามด้วยหน่วยเงินครับ ราคา 5 ดอลลาร์พูดว่า five dollars. 💵 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'five dollars',
      options: [],
    },
    4: {
      textEn:
        'เมื่อตอบเป็นประโยค ให้เติม It\'s ข้างหน้าครับ: It\'s five dollars. แปลว่า “ราคาห้าดอลลาร์” ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's five dollars.",
      options: [],
    },
    5: {
      textEn:
        'ลองใช้กับราคาใหม่ครับ ป้ายนี้เขียนว่า $10 🏷️ คุณจะบอกราคาเป็นภาษาอังกฤษว่าอย่างไร?',
      ttsText:
        'ลองใช้กับราคาใหม่ครับ ป้ายนี้เขียนว่าสิบดอลลาร์ คุณจะบอกราคาเป็นภาษาอังกฤษว่าอย่างไร?',
      withPraise: true,
      stem: '',
      expectedSpeech: "It's ten dollars.",
      incorrectHintTh: 'ยังไม่ตรงครับ เริ่มด้วย “It\'s...” แล้วตามด้วย ten dollars ครับ',
      options: [
        { emoji: '5️⃣', label: 'Five dollars', speak: "It's five dollars." },
        { emoji: '🔟', label: 'Ten dollars', speak: "It's ten dollars." },
        { emoji: '2️⃣0️⃣', label: 'Twenty dollars', speak: "It's twenty dollars." },
      ],
    },
    6: {
      textEn:
        'มาลองคุยกับพนักงานครับ คุณเห็นหนังสือเล่มหนึ่งและยังไม่รู้ราคา 📘 เริ่มบทสนทนาด้วยการถามราคาครับ',
      advanceQuestionEn: 'คุณเห็นหนังสือและยังไม่รู้ราคา ลองถามราคาครับ 📘',
      withPraise: true,
      stem: '',
      expectedSpeech: 'How much is it?',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองถามว่า “How much is it?” ครับ',
      options: [],
    },
    7: {
      textEn:
        'พนักงานตอบว่า It\'s twenty dollars. 💵 ตอนนี้ตอบกลับอย่างสุภาพเพื่อจบบทสนทนาครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Thank you.',
      incorrectHintTh: 'ยังไม่ตรงครับ เมื่อพนักงานบอกราคาแล้ว ลองตอบว่า “Thank you.” ครับ',
      options: [
        { emoji: '🙏', label: 'Thank you', speak: 'Thank you.' },
        { emoji: '❓', label: 'Ask the price', speak: 'How much is it?' },
      ],
    },
  },

  likes_dislikes: {
    1: {
      textEn:
        'สวัสดีครับ {name}! วันนี้เรามาเรียนบอกสิ่งที่ชอบและไม่ชอบครับ ☕ I like... แปลว่า “ฉันชอบ...” เช่น I like coffee. แปลว่า “ฉันชอบกาแฟ” ลองพูดตามว่า “I like coffee.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I like coffee.',
      options: [],
    },
    2: {
      textEn:
        'pizza แปลว่า “พิซซ่า” 🍕 ถ้าคุณชอบพิซซ่า จะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I like pizza.',
      options: [
        { emoji: '🍕', label: 'I like pizza', speak: 'I like pizza.' },
        { emoji: '☕', label: 'I like coffee', speak: 'I like coffee.' },
      ],
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าชอบพิซซ่า ลองพูดว่า “I like pizza.” ครับ',
    },
    3: {
      textEn:
        'tea แปลว่า “ชา” 🍵 ถ้าไม่ชอบชา พูดว่า I don\'t like tea. ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: "I don't like tea.",
      options: [],
    },
    4: {
      textEn:
        'อีกสองคำที่ใช้บ่อยคือ sushi แปลว่า “ซูชิ” 🍣 และ water แปลว่า “น้ำ” 💧 ถ้าชอบซูชิ พูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I like sushi.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าชอบซูชิ ลองพูดว่า “I like sushi.” ครับ',
      options: [
        { emoji: '🍣', label: 'I like sushi', speak: 'I like sushi.' },
        { emoji: '💧', label: 'I like water', speak: 'I like water.' },
      ],
    },
    5: {
      textEn:
        'ตอนนี้ลองบอกสิ่งที่คุณชอบจริง ๆ หนึ่งอย่างครับ เริ่มด้วย I like...',
      advanceQuestionEn: 'What do you like? Answer with I like...',
      withPraise: true,
      stem: 'I like...',
      expectedSpeech: 'I like coffee.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองเริ่มด้วย “I like...” แล้วตามด้วยอาหารหรือเครื่องดื่มครับ',
      options: [],
    },
  },

  fnd_v2_daily_actions: {
    1: {
      textEn:
        'วันนี้เราจะฝึกพูดกิจวัตรประจำวันครับ 🌅 I wake up. แปลว่า “ฉันตื่นนอน” ลองพูดตามว่า “I wake up.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'I wake up.',
      options: [],
    },
    2: {
      textEn:
        'I eat. แปลว่า “ฉันกิน” 🍽️ ลองพูดตามว่า “I eat.” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I eat.',
      options: [],
    },
    3: {
      textEn: 'ตอนนี้คุณกำลังอ่านหนังสือเรียน 📚 คุณจะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I study.',
      incorrectHintTh: 'ยังไม่ตรงครับ ตอนนี้กำลังเรียน ลองพูดว่า “I study.” ครับ',
      options: [
        { emoji: '📚', label: 'I study', speak: 'I study.' },
        { emoji: '💼', label: 'I work', speak: 'I work.' },
      ],
    },
    4: {
      textEn: 'ตอนนี้คุณกำลังทำงานที่โต๊ะ 💼 คุณจะพูดว่าอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I work.',
      incorrectHintTh: 'ยังไม่ตรงครับ ตอนนี้กำลังทำงาน ลองพูดว่า “I work.” ครับ',
      options: [
        { emoji: '💼', label: 'I work', speak: 'I work.' },
        { emoji: '🍽️', label: 'I eat', speak: 'I eat.' },
      ],
    },
    5: {
      textEn:
        'ก่อนจบวัน เราพูดว่า I sleep. แปลว่า “ฉันนอน” 😴 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I sleep.',
      options: [],
    },
    6: {
      textEn:
        'แล้วคุณล่ะ? เลือกสองอย่างที่คุณทำทุกวัน แล้วพูดเป็นสองประโยคครับ เช่น “I work. I eat.”',
      advanceQuestionEn: 'Choose two daily actions and say two I... sentences.',
      withPraise: true,
      stem: '',
      expectedSpeech: 'I work. I eat.',
      incorrectHintTh: 'ยังไม่ตรงครับ เลือกสองอย่างจาก wake up, eat, work, study หรือ sleep แล้วพูดเป็นสองประโยคที่ขึ้นต้นด้วย I ครับ',
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

  fnd_v2_places_directions: {
    1: {
      textEn:
        'วันนี้เราจะเรียนสถานที่และการบอกทางง่ายๆ ครับ 🗺️ bathroom แปลว่า “ห้องน้ำ” ลองพูดตามว่า “bathroom” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'bathroom',
      options: [],
    },
    2: {
      textEn:
        'ถ้าต้องการถามหาห้องน้ำ พูดว่า Where is the bathroom? 🚻 ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Where is the bathroom?',
      options: [],
    },
    3: {
      textEn: 'คุณกำลังหาที่พัก 🏨 คุณจะถามว่าโรงแรมอยู่ที่ไหนอย่างไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Where is the hotel?',
      incorrectHintTh: 'ยังไม่ตรงครับ คุณกำลังหาโรงแรม ลองพูดว่า “Where is the hotel?” ครับ',
      options: [
        { emoji: '🏨', label: 'Where is the hotel?', speak: 'Where is the hotel?' },
        { emoji: '🚻', label: 'Where is the bathroom?', speak: 'Where is the bathroom?' },
      ],
    },
    4: {
      textEn:
        'taxi แปลว่า “รถแท็กซี่” 🚕 ลองพูดตามว่า “taxi” ครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'taxi',
      options: [],
    },
    5: {
      textEn:
        'ถ้าจะบอกให้เดินตรงไป พูดว่า Go straight. ⬆️ ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Go straight.',
      options: [],
    },
    6: {
      textEn:
        'คุณต้องไปขึ้นรถไฟและกำลังหาสถานี 🚉 ลองถามว่า “Where is the station?” ครับ',
      advanceQuestionEn: 'Ask where the station is.',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Where is the station?',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองถามว่า “Where is the station?” ครับ',
      options: [],
    },
  },

  fnd_v2_goodbye_closing: {
    1: {
      textEn:
        'วันนี้เราจะฝึกกล่าวลาและจบบทสนทนาครับ 👋 Goodbye. แปลว่า “ลาก่อน” ลองพูดตามว่า “Goodbye.” ครับ',
      withPraise: false,
      stem: '',
      expectedSpeech: 'Goodbye.',
      options: [],
    },
    2: {
      textEn:
        'ถ้าจะบอกว่า “แล้วเจอกัน” พูดว่า See you later. ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'See you later.',
      options: [],
    },
    3: {
      textEn: 'คุณกำลังแยกกับเพื่อนและจะเจอกันอีก 👋 คุณควรพูดว่าอะไรครับ?',
      withPraise: true,
      stem: '',
      expectedSpeech: 'See you later.',
      incorrectHintTh: 'ยังไม่ตรงครับ ถ้าจะเจอกันอีก ลองพูดว่า “See you later.” ครับ',
      options: [
        { emoji: '👋', label: 'See you later', speak: 'See you later.' },
        { emoji: '🙏', label: 'Thank you', speak: 'Thank you.' },
      ],
    },
    4: {
      textEn:
        'หลังจากคุยกันอย่างเป็นมิตร พูดว่า Nice talking to you. แปลว่า “ดีที่ได้คุยกับคุณ” ลองพูดตามครับ',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Nice talking to you.',
      options: [],
    },
    5: {
      textEn:
        'มาจบบทสนทนาด้วยคำของคุณเองครับ 😊 พูด Goodbye, See you later, Nice talking to you หรือ Have a nice day ก็ได้ครับ',
      advanceQuestionEn: 'Close the conversation in English.',
      withPraise: true,
      stem: '',
      expectedSpeech: 'Goodbye.',
      incorrectHintTh: 'ยังไม่ตรงครับ ลองใช้คำกล่าวลา เช่น “Goodbye.” หรือ “See you later.” ครับ',
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
  fnd_v2_how_do_you_feel: 6,
  talk_about_groups: 5,
  fnd_v2_we_they: 6,
  ee_about_me_family: 8,
  numbers: 4,
  fnd_v2_numbers_11_20: 5,
  fnd_v2_say_it_again: 5,
  fnd_v2_basic_colors: 6,
  fnd_v2_shop_things: 6,
  fnd_v2_buying_something: 6,
  telling_time: 5,
  everyday_numbers: 6,
  money_prices: 7,
  likes_dislikes: 5,
  fnd_v2_daily_actions: 6,
  wants_needs: 5,
  can_cant: 4,
  asking_for_help: 4,
  asking_questions: 5,
  fnd_v2_places_directions: 6,
  fnd_v2_goodbye_closing: 5,
};
