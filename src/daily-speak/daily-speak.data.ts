export type DailySpeakSentence = {
  dayNumber: number;
  id: string;
  en: string;
  th: string;
  /** Thai phonetic reading (คำอ่าน). */
  reading?: string;
  category?: string;
  useWhen?: string;
  tipWord?: string;
  tipIpa?: string;
};

/** Ordered Speak Today pool — pick by dayNumber (1–30). */
export const DAILY_SPEAK_POOL: readonly DailySpeakSentence[] = [
  // Courage & Challenges
  {
    dayNumber: 7,
    id: 'nothing_impossible',
    category: 'Courage & Challenges',
    en: "Nothing is impossible if you're willing to try.",
    reading: 'นะ-ธิง อิซ อิม-พอส-ซิ-เบิล อิฟ ยูว์ อาร์ วิล-ลิง ทู ทราย',
    th: 'ไม่มีอะไรเป็นไปไม่ได้ถ้าคุณพร้อมที่จะลอง',
    useWhen: 'ใช้เตือนตัวเองว่าแค่เริ่มลงมือก็เปิดโอกาสใหม่ ๆ ได้',
  },
  {
    dayNumber: 8,
    id: 'not_afraid_mistakes',
    category: 'Courage & Challenges',
    en: "I'm not afraid to make mistakes.",
    reading: 'ไอม์ น็อท อะ-เฟรย์ด ทู เมค มิส-เทคส์',
    th: 'ฉันไม่กลัวที่จะทำผิด',
    useWhen:
      'ความผิดพลาดเป็นส่วนหนึ่งของการเรียนรู้ ไม่ใช่สิ่งที่ต้องหลีกเลี่ยง',
  },
  {
    dayNumber: 9,
    id: 'comfort_zone',
    category: 'Courage & Challenges',
    en: "I'm ready to step out of my comfort zone.",
    reading: 'ไอม์ เรด-ดี้ ทู สเต็ป เอาท์ ออฟ มาย คัม-เฟิร์ท โซน',
    th: 'ฉันพร้อมก้าวออกจากพื้นที่ปลอดภัยของตัวเอง',
    useWhen: 'ใช้ก่อนลองทำสิ่งใหม่ที่ไม่คุ้นเคย',
  },
  {
    dayNumber: 10,
    id: 'handle_whatever',
    category: 'Courage & Challenges',
    en: 'I can handle whatever comes my way.',
    reading: 'ไอ แคน แฮน-เดิล ว็อท-เอฟ-เวอร์ คัมส์ มาย เวย์',
    th: 'ฉันรับมือกับสิ่งที่เข้ามาได้',
    useWhen:
      'ประโยคสำหรับสร้างความมั่นใจก่อนเจอสถานการณ์ที่คาดเดาไม่ได้',
  },
  {
    dayNumber: 11,
    id: 'wont_give_up',
    category: 'Courage & Challenges',
    en: "I won't give up just because it's difficult.",
    reading: 'ไอ โว้นท์ กิฟ อัพ จัสต์ บิ-คอซ อิทส์ ดิฟ-ฟิ-คอลท์',
    th: 'ฉันจะไม่ยอมแพ้เพียงเพราะมันยาก',
    useWhen: 'ใช้เตือนตัวเองเมื่อเจออุปสรรค',
  },
  {
    dayNumber: 12,
    id: 'hardest_step',
    category: 'Courage & Challenges',
    en: 'Sometimes, the hardest step is simply getting started.',
    reading: 'ซัม-ไทม์ส เดอะ ฮาร์ด-ดิสท์ สเต็ป อิซ ซิม-พลี่ เก็ท-ติ้ง สตาร์ท-ทิด',
    th: 'บางครั้งขั้นตอนที่ยากที่สุดคือการเริ่มต้น',
    useWhen: 'เหมาะกับวันที่รู้ว่าต้องทำอะไร แต่ยังลังเลที่จะเริ่ม',
  },

  // Mindset
  {
    dayNumber: 13,
    id: 'focus_control',
    category: 'Mindset',
    en: 'I choose to focus on what I can control.',
    reading: 'ไอ ชูซ ทู โฟ-คัส ออน ว็อท ไอ แคน คอน-โทรล',
    th: 'ฉันเลือกโฟกัสกับสิ่งที่ฉันควบคุมได้',
    useWhen:
      'ช่วยเปลี่ยนความสนใจจากเรื่องที่ควบคุมไม่ได้กลับมาที่ตัวเอง',
  },
  {
    dayNumber: 14,
    id: 'challenge_grow',
    category: 'Mindset',
    en: 'Every challenge is a chance to grow.',
    reading: 'เอฟ-วรี่ แชล-เลนจ์ อิซ อะ แชนซ์ ทู โกรว์',
    th: 'ทุกความท้าทายคือโอกาสที่จะเติบโต',
    useWhen: 'มองอุปสรรคเป็นประสบการณ์ ไม่ใช่แค่ปัญหา',
  },
  {
    dayNumber: 15,
    id: 'learning_experience',
    category: 'Mindset',
    en: "I'm learning from every experience.",
    reading: 'ไอม์ เลิร์น-นิง ฟรอม เอฟ-วรี่ อิกซ์-เพียร์-ริ-เอินซ์',
    th: 'ฉันเรียนรู้จากทุกประสบการณ์',
    useWhen:
      'ใช้เมื่ออยากมองทั้งความสำเร็จและความผิดพลาดเป็นบทเรียน',
  },
  {
    dayNumber: 16,
    id: 'not_figured_out',
    category: 'Mindset',
    en: "I don't need to have everything figured out.",
    reading: 'ไอ โดนท์ นีด ทู แฮฟ เอฟ-วรี่-ธิง ฟิก-เกิร์ด เอาท์',
    th: 'ฉันไม่จำเป็นต้องรู้ทุกอย่างในตอนนี้',
    useWhen: 'เหมาะกับช่วงที่รู้สึกว่าชีวิตยังไม่ชัดเจน',
  },
  {
    dayNumber: 17,
    id: 'trust_myself',
    category: 'Mindset',
    en: 'I trust myself to find a way forward.',
    reading: 'ไอ ทรัสท์ มาย-เซลฟ์ ทู ไฟนด์ อะ เวย์ ฟอร์-เวิร์ด',
    th: 'ฉันเชื่อว่าตัวเองจะหาทางไปต่อได้',
    useWhen:
      'เป็นประโยคที่ดีเวลายังไม่รู้คำตอบ แต่เชื่อว่าจะรับมือได้',
  },
  {
    dayNumber: 18,
    id: 'small_step',
    category: 'Mindset',
    en: 'A small step is still a step forward.',
    reading: 'อะ สมอล สเต็ป อิซ สทิล อะ สเต็ป ฟอร์-เวิร์ด',
    th: 'ก้าวเล็ก ๆ ก็ยังเป็นก้าวไปข้างหน้า',
    useWhen: 'เตือนว่า progress ไม่จำเป็นต้องใหญ่เสมอไป',
  },

  // Resilience
  {
    dayNumber: 19,
    id: 'overcome_before',
    category: 'Resilience',
    en: "I've overcome difficult things before.",
    reading: 'ไอฟ์ โอ-เวอร์-คัม ดิฟ-ฟิ-คอลท์ ธิงส์ บี-ฟอร์',
    th: 'ฉันเคยผ่านเรื่องยาก ๆ มาแล้ว',
    useWhen: 'ดึงความทรงจำจากอดีตมาเป็นกำลังใจในวันนี้',
  },
  {
    dayNumber: 20,
    id: 'setbacks_define',
    category: 'Resilience',
    en: "Setbacks don't define me.",
    reading: 'เซ็ท-แบคส์ โดนท์ ดี-ไฟน์ มี',
    th: 'ความล้มเหลวไม่ได้เป็นตัวกำหนดว่าฉันเป็นใคร',
    useWhen: 'แยกตัวตนของเราออกจากความผิดพลาดหรือความล้มเหลว',
  },
  {
    dayNumber: 21,
    id: 'start_again',
    category: 'Resilience',
    en: 'I can start again whenever I need to.',
    reading: 'ไอ แคน สตาร์ท อะ-เกน เว็น-เอฟ-เวอร์ ไอ นีด ทู',
    th: 'ฉันสามารถเริ่มต้นใหม่ได้ทุกเมื่อที่ต้องการ',
    useWhen: 'เหมาะกับวันที่รู้สึกว่าตัวเองพลาดหรือหลุดจากเป้าหมาย',
  },
  {
    dayNumber: 22,
    id: 'stronger_yesterday',
    category: 'Resilience',
    en: "I'm stronger than I was yesterday.",
    reading: 'ไอม์ สตรอง-เกอร์ แดน ไอ วอซ เยส-เทอร์-เดย์',
    th: 'วันนี้ฉันแข็งแกร่งกว่าเมื่อวาน',
    useWhen: 'สื่อถึงการเติบโตทีละน้อยจากประสบการณ์ที่ผ่านมา',
  },
  {
    dayNumber: 23,
    id: 'keep_going_slow',
    category: 'Resilience',
    en: "I'll keep going, even when progress feels slow.",
    reading: 'ไอล์ คีพ โก-อิง อี-เวน เวน พรอ-เกรส ฟีลส์ สโลว์',
    th: 'ฉันจะเดินหน้าต่อ แม้ความก้าวหน้าจะดูช้า',
    useWhen: 'เหมาะกับช่วงที่พยายามมานานแต่ยังไม่เห็นผลชัดเจน',
  },
  {
    dayNumber: 24,
    id: 'difficult_days',
    category: 'Resilience',
    en: "Difficult days don't last forever.",
    reading: 'ดิฟ-ฟิ-คอลท์ เดย์ส โดนท์ ลาสท์ ฟอร์-เอฟ-เวอร์',
    th: 'วันที่ยากลำบากไม่ได้อยู่กับเราตลอดไป',
    useWhen: 'เป็น reminder ว่าสถานการณ์แย่ ๆ สามารถเปลี่ยนแปลงได้',
  },

  // Confidence in Real Life
  {
    dayNumber: 25,
    id: 'believe_potential',
    category: 'Confidence in Real Life',
    en: 'I deserve to believe in my own potential.',
    reading: 'ไอ ดี-เซิร์ฟ ทู บี-ลีฟ อิน มาย โอว์น โพ-เทน-เชิล',
    th: 'ฉันคู่ควรที่จะเชื่อในศักยภาพของตัวเอง',
    useWhen: 'ชวนให้เห็นคุณค่าของความสามารถที่ยังไม่ได้ถูกค้นพบ',
  },
  {
    dayNumber: 26,
    id: 'courage_speak_up',
    category: 'Confidence in Real Life',
    en: 'I have the courage to speak up.',
    reading: 'ไอ แฮฟ เดอะ เคอ-เรจ ทู สปีค อัพ',
    th: 'ฉันมีความกล้าที่จะพูดออกมา',
    useWhen:
      'ดีมากสำหรับการเชื่อมกลับเข้ากับ core ของ Banana คือ “กล้าพูด”',
  },
  {
    dayNumber: 27,
    id: 'voice_heard',
    category: 'Confidence in Real Life',
    en: 'My voice deserves to be heard.',
    reading: 'มาย วอยซ์ ดี-เซิร์ฟส์ ทู บี เฮิร์ด',
    th: 'เสียงของฉันคู่ควรที่จะได้รับการรับฟัง',
    useWhen:
      'ประโยคที่สร้าง confidence โดยตรง โดยเฉพาะกับคนที่ไม่กล้าพูด',
  },
  {
    dayNumber: 28,
    id: 'no_approval',
    category: 'Confidence in Real Life',
    en: "I don't need everyone's approval to be myself.",
    reading: 'ไอ โดนท์ นีด เอฟ-วรี่-วันส์ อะ-พรู-วัล ทู บี มาย-เซลฟ์',
    th: 'ฉันไม่จำเป็นต้องได้รับการยอมรับจากทุกคนเพื่อเป็นตัวของตัวเอง',
    useWhen:
      'ใช้เตือนว่าเราไม่จำเป็นต้องเปลี่ยนตัวเองเพื่อให้ทุกคนพอใจ',
  },
  {
    dayNumber: 29,
    id: 'become_today',
    category: 'Confidence in Real Life',
    en: 'The person I want to become starts with what I do today.',
    reading:
      'เดอะ เพอร์-เซิน ไอ วอนท์ ทู บี-คัม สตาร์ทส์ วิธ ว็อท ไอ ดู ทู-เดย์',
    th: 'คนที่ฉันอยากเป็น เริ่มต้นจากสิ่งที่ฉันทำในวันนี้',
    useWhen: 'เชื่อมเป้าหมายระยะยาวกับการลงมือทำในปัจจุบัน',
  },
  {
    dayNumber: 30,
    id: 'proud_of',
    category: 'Confidence in Real Life',
    en: "I'm becoming someone I can be proud of.",
    reading: 'ไอม์ บี-คัม-มิง ซัม-วัน ไอ แคน บี พราวด์ ออฟ',
    th: 'ฉันกำลังกลายเป็นคนที่ตัวเองภูมิใจ',
    useWhen: 'ปิด pool ได้ดี เพราะเป็นทั้ง confidence และ growth',
  },
];

const POOL_SIZE = 30;

export function dailySpeakDayOfChallenge(completionCount: number): number {
  const count = Math.max(Math.floor(completionCount) || 0, 0);
  return (count % POOL_SIZE) + 1;
}

export function sentenceForCompletionCount(
  completionCount: number,
): DailySpeakSentence {
  const day = dailySpeakDayOfChallenge(completionCount);
  const exact = DAILY_SPEAK_POOL.find((s) => s.dayNumber === day);
  if (exact) return exact;

  // Days 1–6 not in pool yet — map into 7–12 (Courage) until filled.
  const fallbackDay = day < 7 ? day + 6 : 7;
  return (
    DAILY_SPEAK_POOL.find((s) => s.dayNumber === fallbackDay) ??
    DAILY_SPEAK_POOL[0]
  );
}
