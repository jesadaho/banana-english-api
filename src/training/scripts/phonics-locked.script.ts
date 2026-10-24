import type { ChatTurn } from '../../session-store/session-store.service';
import type { ScriptTurnResult } from './types';

/**
 * Locked Phonics teaching scripts (8 beats, no Gemini, no learner name).
 * Every line is fixed text so its audio can live in the TTS bank.
 *
 * Beats: 1 intro+word1 · 2 word2 · 3 minimal pair · 4 recall word1+word2
 * (no model) · 5 try-first transfer · 6 reveal (hit: listen / miss: model +
 * repeat) · 7 phrase · 8 complete. Speak beats retry once, then advance.
 */
export type PhonicsLockedWord = {
  word: string;
  th: string;
  /** Highlighted spelling on this word's card (defaults to the lesson letter). */
  letter?: string;
};

export type PhonicsLockedSpec = {
  lessonId: string;
  /** Spoken sound label, e.g. "Short U". */
  soundName: string;
  /** Highlighted spelling on the cards, e.g. "u". */
  letter: string;
  /** Beat 1 explanation before the first model. */
  introTh: string;
  word1: PhonicsLockedWord;
  word2: PhonicsLockedWord;
  /** Beat 2 note after modelling word1 … word2. */
  word2NoteTh?: string;
  /** Minimal pair for beat 3: `base` (default word1) vs `word`. */
  contrast: PhonicsLockedWord & {
    explainTh: string;
    base?: PhonicsLockedWord;
  };
  /** Beat 4 line (default: back to the lesson sound, no model first). */
  recallTh?: string;
  transfer: PhonicsLockedWord & {
    /** Beat 5 hint (default: same letter/sound as word1 and word2). */
    promptTh?: string;
    /** Beat 6 miss hint (default: short sound like word1). */
    missHintTh?: string;
  };
  phrase: { text: string; th: string; noteTh?: string };
  /** Beat 8 summary after the three words (default: same sound). */
  recapTh?: string;
  /** What a target is called in the lines: คำ (default) or วลี. */
  unit?: 'คำ' | 'วลี';
};

const W = (word: string, th: string, letter?: string): PhonicsLockedWord =>
  letter ? { word, th, letter } : { word, th };

const noModel = (u = 'คำ') =>
  `ลองอ่านสอง${u}นี้ต่อกัน คราวนี้ครูบีจะไม่อ่านให้ฟังก่อนนะครับ`;
const LIGHT_A = 'ตัว a ข้างหน้าพูดเบาๆ สั้นๆ นะครับ';

export const PHONICS_LOCKED_SPECS: PhonicsLockedSpec[] = [
  {
    lessonId: 'pron_phonics_01_first_code',
    soundName: 'Short A',
    letter: 'a',
    introTh:
      'วันนี้เราจะเริ่มอ่านคำแรกกันครับ ตัว a ในคำนี้ไม่ได้อ่านว่า "เอ" แต่เป็นเสียงสั้นๆ อ้าปากกว้าง คล้าย "แอะ" ครับ',
    word1: W('mat', 'เสื่อ'),
    word2: W('sat', 'นั่ง'),
    word2NoteTh: 'สังเกตว่าเสียง a ตรงกลางเหมือนกัน ต่างกันแค่เสียงแรก m กับ s ครับ',
    contrast: {
      ...W('mate', 'เพื่อน', 'a_e'),
      explainTh:
        'ถ้าอ่าน a เป็น "เอ" จะกลายเป็นอีกคำหนึ่ง คำของเราวันนี้คือ mat เสียงสั้นๆ',
    },
    transfer: { ...W('at', 'ที่ (เช่น at home)'), missHintTh: 'ใช้เสียงสั้นๆ แบบในคำว่า mat' },
    phrase: {
      text: 'a mat',
      th: 'เสื่อหนึ่งผืน',
      noteTh: 'ตัว a ข้างหน้าพูดเบาๆ สั้นๆ ไม่ใช่เสียง "แอะ" แบบใน mat นะครับ',
    },
  },
  {
    lessonId: 'pron_phonics_02_more_words',
    soundName: 'Short I',
    letter: 'i',
    introTh:
      'วันนี้เราจะฝึกเสียง Short I กันครับ ตัว i ในคำนี้ไม่ได้อ่านว่า "ไอ" แต่เป็นเสียงสั้นๆ คล้าย "อิ" ครับ',
    word1: W('pin', 'เข็มหมุด'),
    word2: W('sit', 'นั่ง'),
    contrast: {
      ...W('pan', 'กระทะ', 'a'),
      explainTh:
        'ต่างกันแค่เสียงสระตรงกลาง pin ใช้เสียง i ส่วน pan ใช้เสียง a ที่เราเรียนมาแล้ว',
    },
    transfer: W('tip', 'ปลาย'),
    phrase: { text: 'a pin', th: 'เข็มหมุดหนึ่งอัน', noteTh: LIGHT_A },
  },
  {
    lessonId: 'pron_phonics_03_short_e',
    soundName: 'Short E',
    letter: 'e',
    introTh:
      'วันนี้เราจะฝึกเสียง Short E กันครับ ตัว e ในคำนี้ไม่ได้อ่านว่า "อี" แต่เป็นเสียงสั้นๆ คล้าย "เอะ" ครับ',
    word1: W('pen', 'ปากกา'),
    word2: W('net', 'ตาข่าย'),
    contrast: {
      ...W('pan', 'กระทะ', 'a'),
      explainTh:
        'ต่างกันแค่เสียงสระตรงกลาง pen ใช้เสียง e ส่วน pan ใช้เสียง a ที่เราเรียนมาแล้ว',
    },
    transfer: W('pet', 'สัตว์เลี้ยง'),
    phrase: { text: 'a pen', th: 'ปากกาหนึ่งด้าม', noteTh: LIGHT_A },
  },
  {
    lessonId: 'pron_phonics_04_short_o',
    soundName: 'Short O',
    letter: 'o',
    introTh:
      'วันนี้เราจะฝึกเสียง Short O กันครับ ตัว o ในคำนี้ไม่ได้อ่านว่า "โอ" แต่เป็นเสียงสั้นๆ อ้าปากกว้าง คล้าย "เอาะ" ครับ',
    word1: W('hot', 'ร้อน'),
    word2: W('pot', 'หม้อ'),
    contrast: {
      ...W('hat', 'หมวก', 'a'),
      explainTh:
        'ต่างกันแค่เสียงสระตรงกลาง hot ใช้เสียง o ส่วน hat ใช้เสียง a ที่เราเรียนมาแล้ว',
    },
    transfer: W('top', 'ด้านบน'),
    phrase: { text: 'a pot', th: 'หม้อหนึ่งใบ', noteTh: LIGHT_A },
  },
  {
    lessonId: 'pron_phonics_05_short_u',
    soundName: 'Short U',
    letter: 'u',
    introTh:
      'วันนี้เราจะฝึกอ่านคำที่ใช้เสียง Short U กันครับ ตัว u ในคำนี้ไม่ได้อ่านว่า "ยู" แต่เป็นเสียงสั้นๆ คล้าย "อะ" ครับ',
    word1: W('cup', 'ถ้วย'),
    word2: W('mug', 'แก้วมีหู'),
    contrast: {
      ...W('cap', 'หมวกแก๊ป', 'a'),
      explainTh:
        'ต่างกันแค่เสียงสระตรงกลาง cup ใช้เสียง u ส่วน cap ใช้เสียง a ที่เราเรียนมาแล้ว',
    },
    transfer: W('mud', 'โคลน'),
    phrase: { text: 'a cup', th: 'ถ้วยหนึ่งใบ', noteTh: LIGHT_A },
  },
  {
    lessonId: 'pron_phonics_06_more_sounds',
    soundName: 'F L R',
    letter: 'f',
    introTh:
      'วันนี้เราจะฝึกเสียง f, l และ r ที่ใช้ขึ้นต้นคำกันครับ เสียง f ให้ฟันบนแตะริมฝีปากล่างแล้วเป่าลมออกมา',
    word1: W('fan', 'พัดลม', 'f'),
    word2: W('leg', 'ขา', 'l'),
    word2NoteTh: 'เสียง l ให้ปลายลิ้นแตะหลังฟันบนครับ',
    contrast: {
      ...W('rip', 'ฉีก', 'r'),
      base: W('lip', 'ริมฝีปาก', 'l'),
      explainTh: 'ต่างกันแค่เสียงแรก lip ปลายลิ้นแตะหลังฟัน ส่วน rip ลิ้นไม่แตะอะไรเลย',
    },
    transfer: {
      ...W('run', 'วิ่ง', 'r'),
      promptTh: 'ตัว r ขึ้นต้นคำนี้ใช้เสียงเดียวกับ rip',
      missHintTh: 'ขึ้นต้นด้วยเสียง r แบบในคำว่า rip ลิ้นไม่แตะอะไร',
    },
    phrase: { text: 'a red pen', th: 'ปากกาสีแดงหนึ่งด้าม' },
    recapTh: 'ครบทั้งเสียง f, l และ r ที่ขึ้นต้นคำแล้วครับ',
  },
  {
    lessonId: 'pron_phonics_07_first_sound',
    soundName: 'W V J',
    letter: 'w',
    introTh:
      'วันนี้เราจะฝึกเสียง w, v และ j ที่ใช้ขึ้นต้นคำกันครับ เสียง w ให้ห่อปากก่อนแล้วค่อยเปิด คล้าย "ว"',
    word1: W('wet', 'เปียก', 'w'),
    word2: W('jam', 'แยม', 'j'),
    word2NoteTh: 'เสียง j คล้าย "จ" แต่มีเสียงก้องครับ',
    contrast: {
      ...W('vet', 'สัตวแพทย์', 'v'),
      explainTh: 'ต่างกันแค่เสียงแรก wet ห่อปาก ส่วน vet ฟันบนแตะริมฝีปากล่างแล้วมีเสียงสั่น',
    },
    transfer: {
      ...W('jet', 'เครื่องบินเจ็ท', 'j'),
      promptTh: 'ตัว j ขึ้นต้นคำนี้ใช้เสียงเดียวกับ jam',
      missHintTh: 'ขึ้นต้นด้วยเสียง j แบบในคำว่า jam',
    },
    phrase: { text: 'a van', th: 'รถตู้หนึ่งคัน', noteTh: LIGHT_A },
    recapTh: 'ครบทั้งเสียง w, v และ j ที่ขึ้นต้นคำแล้วครับ',
  },
  {
    lessonId: 'pron_phonics_08_basic_code',
    soundName: 'Y Z',
    letter: 'y',
    introTh:
      'วันนี้เราจะฝึกเสียง y และ z กันครับ y ที่ขึ้นต้นคำไม่ได้อ่านว่า "วาย" แต่เป็นเสียงคล้าย "ย"',
    word1: W('yes', 'ใช่', 'y'),
    word2: W('zip', 'ซิป', 'z'),
    word2NoteTh: 'เสียง z คล้าย s แต่มีเสียงสั่นในคอครับ',
    contrast: {
      ...W('sip', 'จิบ', 's'),
      base: W('zip', 'ซิป', 'z'),
      explainTh: 'ต่างกันแค่เสียงแรก zip มีเสียงสั่นในคอ ส่วน sip เป็นเสียงลมอย่างเดียว',
    },
    transfer: {
      ...W('yet', 'ยัง', 'y'),
      promptTh: 'ตัว y ขึ้นต้นคำนี้ใช้เสียงเดียวกับ yes',
      missHintTh: 'ขึ้นต้นด้วยเสียง y คล้าย "ย" แบบในคำว่า yes',
    },
    phrase: { text: 'a red zip', th: 'ซิปสีแดงหนึ่งเส้น' },
    recapTh: 'ครบทั้งเสียง y และ z แล้วครับ',
  },
  {
    lessonId: 'pron_phonics_09_two_sounds',
    soundName: 'X',
    letter: 'x',
    introTh:
      'วันนี้เราจะฝึกตัวอักษรที่มีสองเสียงกันครับ x ท้ายคำไม่ได้อ่านว่า "เอ็กซ์" แต่เป็นเสียง k ต่อด้วย s',
    word1: W('box', 'กล่อง'),
    word2: W('six', 'หก'),
    word2NoteTh: 'สังเกตว่าท้ายคำมีเสียง k ต่อด้วย s เหมือนกันเลยครับ',
    contrast: {
      ...W('sick', 'ป่วย', 'ck'),
      base: W('six', 'หก'),
      explainTh: 'six มีเสียง k ต่อด้วย s ส่วน sick จบแค่เสียง k',
    },
    transfer: { ...W('mix', 'ผสม'), missHintTh: 'ท้ายคำเป็นเสียง k ต่อด้วย s แบบในคำว่า box' },
    phrase: { text: 'a box', th: 'กล่องหนึ่งใบ', noteTh: LIGHT_A },
    recapTh: 'ทั้งสามคำมี x ที่เป็นเสียง k ต่อด้วย s ครับ',
  },
  {
    lessonId: 'pron_phonics_10_first_phrases',
    soundName: 'วลี',
    unit: 'วลี',
    letter: 'a',
    introTh:
      'วันนี้เราจะอ่านวลีสั้นๆ กันครับ อ่านทีละคำก่อนแล้วค่อยรวมกัน ตัว a ข้างหน้าพูดเบาๆ สั้นๆ',
    word1: W('a red pen', 'ปากกาสีแดง'),
    word2: W('a big map', 'แผนที่ใหญ่'),
    word2NoteTh: 'สังเกตว่าทุกวลีขึ้นต้นด้วย a เบาๆ เหมือนกันครับ',
    contrast: {
      ...W('a big mop', 'ไม้ถูพื้นอันใหญ่', 'o'),
      base: W('a big map', 'แผนที่ใหญ่'),
      explainTh: 'ต่างกันแค่คำสุดท้าย map ใช้เสียง a ส่วน mop ใช้เสียง o',
    },
    recallTh: `กลับมาที่วลีของเราครับ ${noModel('วลี')}`,
    transfer: {
      ...W('a red bag', 'กระเป๋าสีแดง'),
      promptTh: 'วลีนี้ใช้คำที่เราเรียนมาแล้วทั้งหมด',
      missHintTh: 'อ่านทีละคำ a … red … bag แล้วรวมกัน',
    },
    phrase: { text: 'a big red bag', th: 'กระเป๋าสีแดงใบใหญ่' },
    recapTh: 'อ่านทีละคำแล้วรวมเป็นวลีได้แล้วครับ',
  },
  {
    lessonId: 'pron_phonics_11_sh',
    soundName: 'SH',
    letter: 'sh',
    introTh:
      'วันนี้เราจะฝึกเสียง SH กันครับ s กับ h อยู่ด้วยกันจะกลายเป็นเสียงเดียว คล้าย "ช" แบบเป่าลมยาวๆ ไม่อ่านแยกเป็น s แล้ว h',
    word1: W('ship', 'เรือ'),
    word2: W('shop', 'ร้านค้า'),
    word2NoteTh: 'สังเกตว่าขึ้นต้นด้วยเสียง sh เหมือนกันเลยครับ',
    contrast: {
      ...W('sip', 'จิบ', 's'),
      explainTh: 'ต่างกันแค่เสียงแรก ship เป่าลมเป็นเสียง sh ส่วน sip เป็นเสียง s',
    },
    transfer: { ...W('shut', 'ปิด'), missHintTh: 'ขึ้นต้นด้วยเสียง sh แบบในคำว่า ship' },
    phrase: { text: 'a fish', th: 'ปลาหนึ่งตัว', noteTh: 'fish ก็มี sh อยู่ท้ายคำนะครับ' },
  },
  {
    lessonId: 'pron_phonics_12_ch',
    soundName: 'CH',
    letter: 'ch',
    introTh:
      'วันนี้เราจะฝึกเสียง CH กันครับ c กับ h อยู่ด้วยกันเป็นเสียงเดียว คล้าย "ช" ที่กั้นลมก่อนแล้วปล่อยออกมา',
    word1: W('chip', 'มันฝรั่งทอด'),
    word2: W('chat', 'คุย'),
    word2NoteTh: 'สังเกตว่าขึ้นต้นด้วยเสียง ch เหมือนกันเลยครับ',
    contrast: {
      ...W('ship', 'เรือ', 'sh'),
      explainTh: 'ต่างกันแค่เสียงแรก chip กั้นลมแล้วปล่อย ส่วน ship เป่าลมยาวๆ',
    },
    transfer: { ...W('chop', 'สับ'), missHintTh: 'ขึ้นต้นด้วยเสียง ch แบบในคำว่า chip' },
    phrase: { text: 'a chip', th: 'มันฝรั่งทอดหนึ่งชิ้น', noteTh: LIGHT_A },
  },
  {
    lessonId: 'pron_phonics_13_th',
    soundName: 'TH',
    letter: 'th',
    introTh:
      'วันนี้เราจะฝึกเสียง TH กันครับ วางปลายลิ้นแตะฟันบนเบาๆ แล้วเป่าลมออกมา ไม่ได้อ่านว่า "ท" หรือ "ด"',
    word1: W('thin', 'บาง'),
    word2: W('this', 'นี่'),
    word2NoteTh: 'คำนี้ก็วางลิ้นแบบเดียวกัน แต่มีเสียงสั่นในคอด้วยครับ',
    contrast: {
      ...W('tin', 'กระป๋อง', 't'),
      explainTh: 'ต่างกันแค่เสียงแรก thin ลิ้นแตะฟันแล้วเป่าลม ส่วน tin ลิ้นแตะหลังฟัน',
    },
    transfer: {
      ...W('than', 'กว่า'),
      promptTh: 'ตัว th ในคำนี้ใช้เสียงแบบเดียวกับ this',
      missHintTh: 'ขึ้นต้นด้วยเสียง th แบบในคำว่า this มีเสียงสั่นในคอ',
    },
    phrase: { text: 'this map', th: 'แผนที่นี้' },
    recapTh: 'ทั้งสามคำใช้ th วางปลายลิ้นแตะฟันเหมือนกันครับ',
  },
  {
    lessonId: 'pron_phonics_14_ng_nk',
    soundName: 'NG',
    letter: 'ng',
    introTh:
      'วันนี้เราจะฝึกเสียง NG กันครับ n กับ g ท้ายคำรวมกันเป็นเสียงเดียว คล้าย "ง" ไม่อ่านแยกเป็น n แล้ว g',
    word1: W('sing', 'ร้องเพลง'),
    word2: W('ring', 'แหวน'),
    word2NoteTh: 'สังเกตว่าท้ายคำเป็นเสียง ng เหมือนกันเลยครับ',
    contrast: {
      ...W('sink', 'อ่างล้างจาน', 'nk'),
      explainTh: 'sing จบด้วยเสียง "ง" ส่วน sink มีเสียง "ง" แล้วต่อด้วย k',
    },
    transfer: {
      ...W('pink', 'สีชมพู', 'nk'),
      promptTh: 'คำนี้ลงท้ายด้วย nk แบบในคำว่า sink',
      missHintTh: 'ท้ายคำเป็นเสียง "ง" ต่อด้วย k แบบในคำว่า sink',
    },
    phrase: { text: 'a pink bag', th: 'กระเป๋าสีชมพูหนึ่งใบ' },
    recapTh: 'ได้ทั้งเสียง ng และ nk แล้วครับ',
  },
  {
    lessonId: 'pron_phonics_15_a_e',
    soundName: 'A กับ E ท้ายคำ',
    letter: 'a_e',
    introTh:
      'วันนี้เราจะฝึกคำที่มีตัว e ท้ายคำกันครับ e ท้ายคำไม่ออกเสียง แต่ทำให้ a เปลี่ยนเป็นเสียง "เอ" เหมือนชื่อตัว A',
    word1: W('cape', 'ผ้าคลุม'),
    word2: W('tape', 'เทป'),
    word2NoteTh: 'สังเกตว่า a ออกเสียง "เอ" เหมือนกันเลยครับ',
    contrast: {
      ...W('cap', 'หมวกแก๊ป', 'a'),
      explainTh: 'cap ไม่มี e ท้าย a จึงเป็นเสียงสั้น แต่ cape มี e ท้าย a จึงเป็นเสียง "เอ"',
    },
    recallTh: `กลับมาที่คำที่มี e ท้ายของเราครับ ${noModel()}`,
    transfer: {
      ...W('made', 'ทำ (อดีตของ make)'),
      promptTh: 'คำนี้มี e ท้ายเหมือน cape และ tape',
      missHintTh: 'e ท้ายไม่ออกเสียง แต่ทำให้ a เป็นเสียง "เอ" แบบในคำว่า cape',
    },
    phrase: { text: 'a cape', th: 'ผ้าคลุมหนึ่งผืน', noteTh: LIGHT_A },
    recapTh: 'ทั้งสามคำมี e ท้ายที่ทำให้ a เป็นเสียง "เอ" ครับ',
  },
  {
    lessonId: 'pron_phonics_16_i_e',
    soundName: 'I กับ E ท้ายคำ',
    letter: 'i_e',
    introTh:
      'วันนี้เราจะฝึกคำที่มีตัว e ท้ายคำกันครับ e ท้ายคำไม่ออกเสียง แต่ทำให้ i เปลี่ยนเป็นเสียง "ไอ" เหมือนชื่อตัว I',
    word1: W('kite', 'ว่าว'),
    word2: W('pine', 'ต้นสน'),
    word2NoteTh: 'สังเกตว่า i ออกเสียง "ไอ" เหมือนกันเลยครับ',
    contrast: {
      ...W('kit', 'ชุดอุปกรณ์', 'i'),
      explainTh: 'kit ไม่มี e ท้าย i จึงเป็นเสียงสั้น แต่ kite มี e ท้าย i จึงเป็นเสียง "ไอ"',
    },
    recallTh: `กลับมาที่คำที่มี e ท้ายของเราครับ ${noModel()}`,
    transfer: {
      ...W('ride', 'ขี่'),
      promptTh: 'คำนี้มี e ท้ายเหมือน kite และ pine',
      missHintTh: 'e ท้ายไม่ออกเสียง แต่ทำให้ i เป็นเสียง "ไอ" แบบในคำว่า kite',
    },
    phrase: { text: 'a kite', th: 'ว่าวหนึ่งตัว', noteTh: LIGHT_A },
    recapTh: 'ทั้งสามคำมี e ท้ายที่ทำให้ i เป็นเสียง "ไอ" ครับ',
  },
  {
    lessonId: 'pron_phonics_17_o_e',
    soundName: 'O กับ E ท้ายคำ',
    letter: 'o_e',
    introTh:
      'วันนี้เราจะฝึกคำที่มีตัว e ท้ายคำกันครับ e ท้ายคำไม่ออกเสียง แต่ทำให้ o เปลี่ยนเป็นเสียง "โอว" เหมือนชื่อตัว O',
    word1: W('hope', 'หวัง'),
    word2: W('note', 'โน้ต'),
    word2NoteTh: 'สังเกตว่า o ออกเสียง "โอว" เหมือนกันเลยครับ',
    contrast: {
      ...W('hop', 'กระโดด', 'o'),
      explainTh: 'hop ไม่มี e ท้าย o จึงเป็นเสียงสั้น แต่ hope มี e ท้าย o จึงเป็นเสียง "โอว"',
    },
    recallTh: `กลับมาที่คำที่มี e ท้ายของเราครับ ${noModel()}`,
    transfer: {
      ...W('home', 'บ้าน'),
      promptTh: 'คำนี้มี e ท้ายเหมือน hope และ note',
      missHintTh: 'e ท้ายไม่ออกเสียง แต่ทำให้ o เป็นเสียง "โอว" แบบในคำว่า hope',
    },
    phrase: { text: 'a note', th: 'โน้ตหนึ่งแผ่น', noteTh: LIGHT_A },
    recapTh: 'ทั้งสามคำมี e ท้ายที่ทำให้ o เป็นเสียง "โอว" ครับ',
  },
  {
    lessonId: 'pron_phonics_18_ee_ea',
    soundName: '"อี" ยาว',
    letter: 'ee',
    introTh:
      'วันนี้เราจะฝึกเสียง "อี" ยาวกันครับ ee กับ ea ในคำของวันนี้ออกเสียงเหมือนกัน คือ "อี" ยาวๆ',
    word1: W('see', 'เห็น', 'ee'),
    word2: W('tea', 'ชา', 'ea'),
    word2NoteTh: 'คำนี้เขียนด้วย ea แต่เสียงเหมือน ee เลยครับ',
    contrast: {
      ...W('fit', 'พอดี', 'i'),
      base: W('feet', 'เท้า', 'ee'),
      explainTh: 'feet เป็นเสียง "อี" ยาว ส่วน fit เป็นเสียง "อิ" สั้น',
    },
    transfer: {
      ...W('team', 'ทีม', 'ea'),
      promptTh: 'ตัว ea ในคำนี้ใช้เสียงเดียวกับ tea',
      missHintTh: 'ใช้เสียง "อี" ยาวแบบในคำว่า tea',
    },
    phrase: {
      text: 'green tea',
      th: 'ชาเขียว',
      noteTh: 'green ก็มี ee เสียง "อี" ยาวเหมือนกันนะครับ',
    },
  },
  {
    lessonId: 'pron_phonics_19_ai_ay',
    soundName: '"เอ" ยาว',
    letter: 'ai',
    introTh:
      'วันนี้เราจะฝึก ai กับ ay กันครับ ทั้งสองแบบออกเสียง "เอ" เหมือนใน cape ที่เราเรียนมาแล้ว',
    word1: W('rain', 'ฝน', 'ai'),
    word2: W('day', 'วัน', 'ay'),
    word2NoteTh: 'คำนี้เขียนด้วย ay แต่เสียงเหมือน ai เลยครับ',
    contrast: {
      ...W('ran', 'วิ่ง (อดีตของ run)', 'a'),
      explainTh: 'rain เป็นเสียง "เอ" ยาว ส่วน ran เป็นเสียง a สั้น',
    },
    transfer: {
      ...W('paid', 'จ่ายแล้ว', 'ai'),
      promptTh: 'ตัว ai ในคำนี้ใช้เสียงเดียวกับ rain',
      missHintTh: 'ใช้เสียง "เอ" แบบในคำว่า rain',
    },
    phrase: {
      text: 'a train',
      th: 'รถไฟหนึ่งขบวน',
      noteTh: 'tr ต่อกันเลย ไม่แทรกเสียง "อะ" นะครับ',
    },
  },
  {
    lessonId: 'pron_phonics_20_oa',
    soundName: 'OA',
    letter: 'oa',
    introTh:
      'วันนี้เราจะฝึก oa กันครับ o กับ a อยู่ด้วยกันออกเสียง "โอว" เหมือนใน hope ที่เราเรียนมาแล้ว',
    word1: W('boat', 'เรือ'),
    word2: W('coat', 'เสื้อโค้ท'),
    word2NoteTh: 'สังเกตว่า oa ออกเสียง "โอว" เหมือนกันเลยครับ',
    contrast: {
      ...W('cot', 'เตียงเด็ก', 'o'),
      base: W('coat', 'เสื้อโค้ท'),
      explainTh: 'coat เป็นเสียง "โอว" ส่วน cot เป็นเสียง o สั้น',
    },
    transfer: { ...W('soap', 'สบู่'), missHintTh: 'ใช้เสียง "โอว" แบบในคำว่า boat' },
    phrase: { text: 'a boat', th: 'เรือหนึ่งลำ', noteTh: LIGHT_A },
  },
];

export const PHONICS_LOCKED_PROGRESS_MAX = 8;

const RETRY_TH = 'ลองอีกครั้งนะครับ';
const MISS_MARK = 'miss';

export function phonicsLockedSpecFor(
  lessonId: string,
): PhonicsLockedSpec | undefined {
  return PHONICS_LOCKED_SPECS.find((spec) => spec.lessonId === lessonId);
}

export function isPhonicsLockedLesson(lessonId: string): boolean {
  return phonicsLockedSpecFor(lessonId) != null;
}

type Beat = {
  step: number;
  text: string;
  /** '' = listen-only beat (tap to continue). */
  expected: string;
  cards: Array<{ emoji: string; label: string; speak: string }>;
  retryText?: string;
  choice?: string;
  complete?: boolean;
};

function beats(spec: PhonicsLockedSpec) {
  const { word1: w1, word2: w2, contrast: c, transfer: t, phrase: p } = spec;
  const card = (w: PhonicsLockedWord) => ({
    emoji: w.letter ?? spec.letter,
    label: w.word,
    speak: w.word,
  });
  const base = c.base ?? w1;
  const u = spec.unit ?? 'คำ';
  const retry = (say: string) => `${RETRY_TH}\n${say}`;
  const means = (w: PhonicsLockedWord) => `${w.word} แปลว่า${w.th}`;
  const contrastMeaning = c.base
    ? `${means(base)} ส่วน ${means(c)}ครับ`
    : `${means(c)}ครับ`;
  return {
    1: {
      step: 1,
      text: `${spec.introTh} ฟัง${u}นี้นะครับ ${w1.word} … ลองพูดตามครับ ${w1.word}`,
      expected: w1.word,
      cards: [card(w1)],
      retryText: retry(w1.word),
    },
    2: {
      step: 2,
      text: `${means(w1)}ครับ ส่วน${u}นี้อ่านว่า ${w2.word} แปลว่า${w2.th} ${spec.word2NoteTh ?? 'สังเกตว่าเสียงสระเหมือนกันเลยครับ'} ${w1.word} … ${w2.word} ทีนี้ลองพูด${u}ว่า ${w2.word} ครับ`,
      expected: w2.word,
      cards: [card(w2)],
      retryText: retry(w2.word),
    },
    3: {
      step: 3,
      text: `ทีนี้ลองฟังสอง${u}นี้นะครับ ${base.word} … ${c.word} ${c.explainTh} ${contrastMeaning} ลองพูดช้าๆ ทั้งสอง${u}ครับ ${base.word} … ${c.word}`,
      expected: `${base.word} ${c.word}`,
      cards: [card(base), card(c)],
      retryText: retry(`${base.word} … ${c.word}`),
    },
    4: {
      step: 4,
      text: spec.recallTh ?? `กลับมาที่เสียง ${spec.soundName} ของเราครับ ${noModel(u)}`,
      expected: `${w1.word} ${w2.word}`,
      cards: [card(w1), card(w2)],
      retryText: `ฟังอีกทีนะครับ ${w1.word} … ${w2.word} ลองอีกครั้งครับ`,
    },
    5: {
      step: 5,
      text: `ทีนี้ลองอ่าน${u}ใหม่ดูครับ ${t.promptTh ?? `ตัว ${t.letter ?? spec.letter} ใน${u}นี้ใช้เสียงเดียวกับ ${w1.word} และ ${w2.word}`} ${u}นี้อ่านว่าอะไรครับ?`,
      expected: t.word,
      cards: [card(t)],
    },
    '6hit': {
      step: 6,
      text: `ใช่ครับ ${means(t)}ครับ คุณอ่าน${u}ใหม่ได้เองแล้ว!`,
      expected: '',
      cards: [card(t)],
    },
    '6miss': {
      step: 6,
      text: `ลองฟัง${u}นี้อีกทีนะครับ ${t.word} … ${t.missHintTh ?? `ใช้เสียงสระสั้นๆ แบบในคำว่า ${w1.word}`} ${means(t)}ครับ ลองพูดตามอีกครั้งครับ ${t.word}`,
      expected: t.word,
      cards: [card(t)],
      choice: MISS_MARK,
    },
    7: {
      step: 7,
      text: `ก่อนจบ ลองเพิ่มอีกนิดครับ ถ้าจะพูดว่า "${p.th}" เราพูดว่า ${p.text}${p.noteTh ? ` ${p.noteTh}` : ''} ฟังอีกครั้ง ${p.text} … ลองพูดตามครับ`,
      expected: p.text,
      cards: [card({ word: p.text, th: p.th })],
      retryText: retry(p.text),
    },
    8: {
      step: 8,
      text: `วันนี้เราได้ฝึก ${w1.word}, ${w2.word}, ${t.word} ${spec.recapTh ?? `ทั้งสาม${u}ใช้เสียง ${spec.soundName} เหมือนกันครับ`} แล้วเจอกันบทหน้าครับ!`,
      expected: '',
      cards: [card(w1), card(w2), card(t)],
      complete: true,
    },
  } satisfies Record<string, Beat>;
}

function toResult(beat: Beat, opts?: { retry?: boolean }): ScriptTurnResult {
  const text = opts?.retry && beat.retryText ? beat.retryText : beat.text;
  const speak = beat.expected !== '' && !beat.complete;
  return {
    v7Step: beat.step,
    v7Retry: opts?.retry || undefined,
    v7Choice: beat.choice,
    textEn: text,
    ttsText: text,
    textTh: '',
    isLessonComplete: beat.complete === true,
    expectsUserSpeech: speak,
    expectedSpeech: speak ? beat.expected : '',
    ...(beat.cards.length ? { emojiChoice: { options: beat.cards } } : {}),
    ...(beat.complete ? { completionStatus: 'completed_independently' as const } : {}),
  };
}

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Lexical match only (STT text, not acoustic evidence): every target word said. */
export function phonicsLockedMatches(userText: string, expected: string): boolean {
  const said = new Set(words(userText));
  const target = words(expected).filter((w) => w !== 'a');
  return target.length > 0 && target.every((w) => said.has(w));
}

export function buildPhonicsLockedOpening(lessonId: string): ScriptTurnResult {
  const spec = phonicsLockedSpecFor(lessonId);
  if (!spec) throw new Error(`missing locked phonics spec: ${lessonId}`);
  return toResult(beats(spec)[1]);
}

export function buildPhonicsLockedAfterUser(input: {
  lessonId: string;
  turns: ChatTurn[];
  userText: string;
}): ScriptTurnResult {
  const spec = phonicsLockedSpecFor(input.lessonId);
  if (!spec) throw new Error(`missing locked phonics spec: ${input.lessonId}`);
  const b = beats(spec);
  const lastAi = [...input.turns].reverse().find((t) => t.speaker === 'ai');
  const step = lastAi?.v7Step ?? 1;
  const retried = lastAi?.v7Retry === true;
  const hit = phonicsLockedMatches(input.userText, lastAi?.expectedSpeech ?? '');

  switch (step) {
    case 5:
      return toResult(hit ? b['6hit'] : b['6miss']);
    case 6:
      return toResult(b[7]);
    case 1:
    case 2:
    case 3:
    case 4:
    case 7: {
      const current = b[step as 1 | 2 | 3 | 4 | 7];
      if (!hit && !retried) return toResult(current, { retry: true });
      const next = (step === 7 ? 8 : step + 1) as 2 | 3 | 4 | 5 | 8;
      return toResult(b[next]);
    }
    default:
      return toResult(b[8]);
  }
}

/** Every fixed line, for the TTS bank build. */
export function collectPhonicsLockedBankLines(): string[] {
  const lines = new Set<string>();
  for (const spec of PHONICS_LOCKED_SPECS) {
    for (const beat of Object.values(beats(spec)) as Beat[]) {
      lines.add(beat.text);
      if (beat.retryText) lines.add(beat.retryText);
    }
  }
  return [...lines].sort((a, b) => a.localeCompare(b));
}

/** Human-readable dump of one lesson's script (review / admin). */
export function phonicsLockedScriptText(lessonId: string): string[] {
  const spec = phonicsLockedSpecFor(lessonId);
  if (!spec) return [];
  const b = beats(spec) as Record<string, Beat>;
  const order = ['1', '2', '3', '4', '5', '6hit', '6miss', '7', '8'];
  return order.map((key) => [key, b[key]!] as [string, Beat]).flatMap(
    ([key, beat]) => [
      `${key}. ${beat.text}`,
      ...(beat.retryText ? [`   ไม่ตรง: ${beat.retryText.replace('\n', ' ')}`] : []),
    ],
  );
}
