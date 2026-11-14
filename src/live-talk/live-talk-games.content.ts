/**
 * Live Talk mini-game content. Draw & Guess words are things an A1/A2 learner
 * can draw in under a minute; Who Am I? characters are easy to ask Yes/No
 * questions about ("Am I an animal?", "Do I work in a hospital?").
 */
export type LiveTalkGameLevel = 'A1' | 'A2';

export type DrawWord = {
  en: string;
  th: string;
  category: string;
  level: LiveTalkGameLevel;
  /** Other answers that count (plural, US/UK spelling, common synonyms). */
  also?: string[];
};

export type WhoCharacter = {
  en: string;
  th: string;
  kind: 'job' | 'animal' | 'thing';
  level: LiveTalkGameLevel;
};

const w = (
  en: string,
  th: string,
  category: string,
  level: LiveTalkGameLevel = 'A1',
  also?: string[],
): DrawWord => ({ en, th, category, level, ...(also ? { also } : {}) });

export const DRAW_WORDS: readonly DrawWord[] = [
  // animals
  w('cat', 'แมว', 'animal', 'A1', ['kitten']),
  w('dog', 'หมา', 'animal', 'A1', ['puppy']),
  w('fish', 'ปลา', 'animal'),
  w('bird', 'นก', 'animal'),
  w('elephant', 'ช้าง', 'animal'),
  w('rabbit', 'กระต่าย', 'animal', 'A1', ['bunny']),
  w('snake', 'งู', 'animal'),
  w('duck', 'เป็ด', 'animal'),
  w('pig', 'หมู', 'animal'),
  w('cow', 'วัว', 'animal'),
  w('horse', 'ม้า', 'animal'),
  w('chicken', 'ไก่', 'animal', 'A1', ['hen']),
  w('monkey', 'ลิง', 'animal'),
  w('lion', 'สิงโต', 'animal'),
  w('giraffe', 'ยีราฟ', 'animal', 'A2'),
  w('spider', 'แมงมุม', 'animal', 'A2'),
  w('turtle', 'เต่า', 'animal', 'A2', ['tortoise']),
  w('butterfly', 'ผีเสื้อ', 'animal', 'A2'),
  // food
  w('apple', 'แอปเปิล', 'food'),
  w('banana', 'กล้วย', 'food'),
  w('egg', 'ไข่', 'food'),
  w('bread', 'ขนมปัง', 'food'),
  w('pizza', 'พิซซ่า', 'food'),
  w('cake', 'เค้ก', 'food'),
  w('ice cream', 'ไอศกรีม', 'food', 'A1', ['icecream']),
  w('rice', 'ข้าว', 'food'),
  w('noodles', 'ก๋วยเตี๋ยว', 'food', 'A1', ['noodle']),
  w('watermelon', 'แตงโม', 'food', 'A2'),
  w('carrot', 'แครอท', 'food', 'A2'),
  w('hamburger', 'แฮมเบอร์เกอร์', 'food', 'A2', ['burger']),
  w('orange', 'ส้ม', 'food'),
  w('coffee', 'กาแฟ', 'food'),
  // home & things
  w('house', 'บ้าน', 'place', 'A1', ['home']),
  w('door', 'ประตู', 'thing'),
  w('window', 'หน้าต่าง', 'thing'),
  w('bed', 'เตียง', 'thing'),
  w('chair', 'เก้าอี้', 'thing'),
  w('table', 'โต๊ะ', 'thing', 'A1', ['desk']),
  w('cup', 'ถ้วย', 'thing', 'A1', ['mug']),
  w('book', 'หนังสือ', 'thing'),
  w('pen', 'ปากกา', 'thing'),
  w('pencil', 'ดินสอ', 'thing'),
  w('bag', 'กระเป๋า', 'thing', 'A1', ['backpack']),
  w('phone', 'โทรศัพท์', 'thing', 'A1', ['mobile', 'smartphone']),
  w('key', 'กุญแจ', 'thing'),
  w('clock', 'นาฬิกา', 'thing'),
  w('watch', 'นาฬิกาข้อมือ', 'thing', 'A2'),
  w('lamp', 'โคมไฟ', 'thing', 'A2'),
  w('television', 'โทรทัศน์', 'thing', 'A2', ['tv']),
  w('computer', 'คอมพิวเตอร์', 'thing', 'A2', ['laptop']),
  w('umbrella', 'ร่ม', 'thing', 'A2'),
  w('scissors', 'กรรไกร', 'thing', 'A2'),
  w('toothbrush', 'แปรงสีฟัน', 'thing', 'A2'),
  w('glasses', 'แว่นตา', 'thing', 'A2'),
  // clothes
  w('hat', 'หมวก', 'clothes', 'A1', ['cap']),
  w('shoe', 'รองเท้า', 'clothes', 'A1', ['shoes']),
  w('shirt', 'เสื้อ', 'clothes', 'A1', ['t-shirt', 'tshirt']),
  w('dress', 'ชุดกระโปรง', 'clothes', 'A2'),
  w('sock', 'ถุงเท้า', 'clothes', 'A2', ['socks']),
  // nature & weather
  w('sun', 'ดวงอาทิตย์', 'nature'),
  w('moon', 'ดวงจันทร์', 'nature'),
  w('star', 'ดาว', 'nature'),
  w('tree', 'ต้นไม้', 'nature'),
  w('flower', 'ดอกไม้', 'nature'),
  w('rain', 'ฝน', 'weather'),
  w('cloud', 'เมฆ', 'weather'),
  w('rainbow', 'รุ้ง', 'weather', 'A2'),
  w('mountain', 'ภูเขา', 'nature', 'A2'),
  w('beach', 'ชายหาด', 'place', 'A2'),
  w('snowman', 'ตุ๊กตาหิมะ', 'weather', 'A2'),
  // transport
  w('car', 'รถยนต์', 'transport'),
  w('bus', 'รถบัส', 'transport'),
  w('boat', 'เรือ', 'transport', 'A1', ['ship']),
  w('plane', 'เครื่องบิน', 'transport', 'A1', ['airplane', 'aeroplane']),
  w('train', 'รถไฟ', 'transport'),
  w('bicycle', 'จักรยาน', 'transport', 'A2', ['bike']),
  w('motorcycle', 'มอเตอร์ไซค์', 'transport', 'A2', ['motorbike']),
  // body & people
  w('eye', 'ตา', 'body'),
  w('hand', 'มือ', 'body'),
  w('foot', 'เท้า', 'body', 'A1', ['feet']),
  w('nose', 'จมูก', 'body'),
  w('ear', 'หู', 'body'),
  w('mouth', 'ปาก', 'body'),
  w('baby', 'ทารก', 'people'),
  // fun & places
  w('ball', 'ลูกบอล', 'thing'),
  w('guitar', 'กีตาร์', 'thing', 'A2'),
  w('balloon', 'ลูกโป่ง', 'thing', 'A2'),
  w('kite', 'ว่าว', 'thing', 'A2'),
  w('gift', 'ของขวัญ', 'thing', 'A2', ['present']),
  w('school', 'โรงเรียน', 'place'),
  w('hospital', 'โรงพยาบาล', 'place', 'A2'),
  w('bridge', 'สะพาน', 'place', 'A2'),
  w('heart', 'หัวใจ', 'shape'),
  w('robot', 'หุ่นยนต์', 'thing', 'A2'),
];

const c = (
  en: string,
  th: string,
  kind: WhoCharacter['kind'],
  level: LiveTalkGameLevel = 'A1',
): WhoCharacter => ({ en, th, kind, level });

export const WHO_CHARACTERS: readonly WhoCharacter[] = [
  // jobs
  c('teacher', 'ครู', 'job'),
  c('doctor', 'หมอ', 'job'),
  c('nurse', 'พยาบาล', 'job'),
  c('chef', 'พ่อครัว / แม่ครัว', 'job'),
  c('police officer', 'ตำรวจ', 'job'),
  c('farmer', 'ชาวนา / เกษตรกร', 'job'),
  c('student', 'นักเรียน', 'job'),
  c('singer', 'นักร้อง', 'job'),
  c('driver', 'คนขับรถ', 'job'),
  c('pilot', 'นักบิน', 'job', 'A2'),
  c('dentist', 'หมอฟัน', 'job', 'A2'),
  c('firefighter', 'นักดับเพลิง', 'job', 'A2'),
  c('artist', 'ศิลปิน', 'job', 'A2'),
  c('waiter', 'พนักงานเสิร์ฟ', 'job', 'A2'),
  c('soldier', 'ทหาร', 'job', 'A2'),
  c('football player', 'นักฟุตบอล', 'job', 'A2'),
  c('photographer', 'ช่างภาพ', 'job', 'A2'),
  c('astronaut', 'นักบินอวกาศ', 'job', 'A2'),
  // animals
  c('cat', 'แมว', 'animal'),
  c('dog', 'หมา', 'animal'),
  c('elephant', 'ช้าง', 'animal'),
  c('fish', 'ปลา', 'animal'),
  c('bird', 'นก', 'animal'),
  c('monkey', 'ลิง', 'animal'),
  c('lion', 'สิงโต', 'animal'),
  c('cow', 'วัว', 'animal'),
  c('chicken', 'ไก่', 'animal'),
  c('rabbit', 'กระต่าย', 'animal'),
  c('snake', 'งู', 'animal'),
  c('penguin', 'เพนกวิน', 'animal', 'A2'),
  c('kangaroo', 'จิงโจ้', 'animal', 'A2'),
  c('shark', 'ฉลาม', 'animal', 'A2'),
  c('panda', 'แพนด้า', 'animal', 'A2'),
  c('frog', 'กบ', 'animal', 'A2'),
  // things
  c('phone', 'โทรศัพท์', 'thing'),
  c('car', 'รถยนต์', 'thing'),
  c('book', 'หนังสือ', 'thing'),
  c('apple', 'แอปเปิล', 'thing'),
  c('banana', 'กล้วย', 'thing'),
  c('chair', 'เก้าอี้', 'thing'),
  c('bed', 'เตียง', 'thing'),
  c('ball', 'ลูกบอล', 'thing'),
  c('pizza', 'พิซซ่า', 'thing'),
  c('bus', 'รถบัส', 'thing'),
  c('house', 'บ้าน', 'thing'),
  c('umbrella', 'ร่ม', 'thing', 'A2'),
  c('computer', 'คอมพิวเตอร์', 'thing', 'A2'),
  c('refrigerator', 'ตู้เย็น', 'thing', 'A2'),
  c('airplane', 'เครื่องบิน', 'thing', 'A2'),
  c('guitar', 'กีตาร์', 'thing', 'A2'),
  c('ice cream', 'ไอศกรีม', 'thing', 'A2'),
  c('toothbrush', 'แปรงสีฟัน', 'thing', 'A2'),
];

/** A1 rooms get A1 words; A2 rooms get both. */
export function contentForLevel<T extends { level: LiveTalkGameLevel }>(
  items: readonly T[],
  level: LiveTalkGameLevel,
): T[] {
  return items.filter((item) => level === 'A2' || item.level === 'A1');
}
