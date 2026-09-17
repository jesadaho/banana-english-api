export type FoundationV7ChoiceOption = {
  emoji: string;
  label: string;
  speak: string;
};

export type FoundationV7ChoiceBeat = {
  afterBlock: number;
  promptTh: string;
  stem: string;
  answerMode: 'single' | 'any';
  expectedSpeech?: string;
  incorrectHintTh?: string;
  options: FoundationV7ChoiceOption[];
};

const option = (emoji: string, label: string, speak: string): FoundationV7ChoiceOption => ({ emoji, label, speak });

const single = (
  afterBlock: number,
  promptTh: string,
  stem: string,
  expectedSpeech: string,
  incorrectHintTh: string,
  options: FoundationV7ChoiceOption[],
): FoundationV7ChoiceBeat => ({ afterBlock, promptTh, stem, answerMode: 'single', expectedSpeech, incorrectHintTh, options });

const any = (
  afterBlock: number,
  promptTh: string,
  stem: string,
  options: FoundationV7ChoiceOption[],
): FoundationV7ChoiceBeat => ({ afterBlock, promptTh, stem, answerMode: 'any', options });

/**
 * Authored choice beats for every Foundation V7 lesson.
 * Labels stay short; `speak` is the complete utterance sent to speech practice.
 */
export const FOUNDATION_V7_CHOICE_BEATS: Record<string, FoundationV7ChoiceBeat> = {
  fnd_v7_please_and_thank_you: single(1, 'พนักงานยื่นน้ำให้คุณ คุณควรพูดอะไร', '', 'Thank you', 'มีคนยื่นของให้เรา ใช้คำขอบคุณครับ', [
    option('🙏', 'please', 'Please'), option('💝', 'thank you', 'Thank you'),
  ]),
  fnd_v7_say_that_again: single(2, 'อีกฝ่ายพูดเร็วเกินไป คุณควรขออย่างไร', 'Please...', 'Please speak slowly', 'เลือกคำที่ขอให้พูดช้าลงครับ', [
    option('🔁', 'say again', 'Please say that again'), option('🐢', 'speak slowly', 'Please speak slowly'),
  ]),
  fnd_v7_i_am_you_are: any(2, 'ตอนนี้คุณรู้สึกอย่างไร เลือกคำที่ตรงกับคุณ', 'I am...', [
    option('✅', 'ready', 'I am ready'), option('😴', 'tired', 'I am tired'), option('🍽️', 'hungry', 'I am hungry'),
  ]),
  fnd_v7_not_and_are_you: single(2, 'คุณอยากถามเพื่อนว่าเขาพร้อมไหม', 'Are you...', 'Are you ready?', 'ใช้ Are you... เพื่อถามอีกฝ่ายครับ', [
    option('✅', 'ready', 'Are you ready?'), option('😴', 'tired', 'Are you tired?'),
  ]),
  fnd_v7_he_she_it_we_they: single(2, 'คุณกับเพื่อนอยู่กลุ่มเดียวกัน เลือกประธานที่หมายถึง “พวกเรา”', '...are friends', 'We are friends', 'ตัวเราอยู่ในกลุ่มด้วยจึงใช้ We ครับ', [
    option('👫', 'we', 'We are friends'), option('👥', 'they', 'They are friends'),
  ]),
  fnd_v7_my_family: any(2, 'เลือกสมาชิกครอบครัวหนึ่งคนเพื่อแนะนำ', 'This is my...', [
    option('👩', 'mother', 'This is my mother'), option('👨', 'father', 'This is my father'), option('👧', 'sister', 'This is my sister'), option('👦', 'brother', 'This is my brother'),
  ]),
  fnd_v7_one_or_more: single(3, 'คุณต้องการหนังสือหลายเล่ม ควรเลือกคำไหน', '..., please', 'Books, please', 'หลายเล่มต้องใช้ books ที่มีเสียง s ท้ายคำครับ', [
    option('📖', 'a book', 'A book, please'), option('📚', 'books', 'Books, please'), option('🍎', 'an apple', 'An apple, please'),
  ]),
  fnd_v7_this_is_that_is: single(2, 'กระเป๋าอยู่ไกลจากตัวคุณ ควรใช้คำไหน', '...is a bag', 'That is a bag', 'ของที่อยู่ไกลใช้ that ครับ', [
    option('👇', 'this', 'This is a bag'), option('👉', 'that', 'That is a bag'),
  ]),
  fnd_v7_colours_and_size: any(3, 'เลือกกระเป๋าสมมติหนึ่งใบแล้วบรรยาย', 'This is a...bag', [
    option('🔵', 'blue', 'This is a blue bag'), option('🟢', 'green', 'This is a green bag'), option('🐘', 'big', 'This is a big bag'), option('🐭', 'small', 'This is a small bag'),
  ]),
  fnd_v7_these_and_those: single(2, 'กระเป๋าหลายใบอยู่ไกลตัว ควรเริ่มด้วยคำไหน', '...are bags', 'Those are bags', 'หลายชิ้นที่อยู่ไกลใช้ those ครับ', [
    option('👇', 'these', 'These are bags'), option('👉', 'those', 'Those are bags'),
  ]),
  fnd_v7_my_and_your: any(2, 'เลือกของหนึ่งชิ้นเพื่อบอกว่าเป็นของคุณ', 'This is my...', [
    option('📱', 'phone', 'This is my phone'), option('🔑', 'key', 'This is my key'), option('👕', 'shirt', 'This is my shirt'), option('🎒', 'bag', 'This is my bag'),
  ]),
  fnd_v7_his_her_our_their: single(2, 'กุญแจหลายดอกเป็นของคนกลุ่มนั้น ใช้คำแสดงเจ้าของคำไหน', 'These are...keys', 'These are their keys', 'ของคนหลายคนที่ไม่รวมเราใช้ their ครับ', [
    option('👨', 'his', 'These are his keys'), option('👩', 'her', 'These are her keys'), option('👥', 'their', 'These are their keys'),
  ]),
  fnd_v7_have_and_has: single(2, 'Mia มีหนังสือหนึ่งเล่ม เลือกสิ่งที่เธอมีแล้วพูดให้ครบประโยค', 'She has...', 'She has a book', 'เลือก book และใช้ She has กับ Mia ครับ', [
    option('📖', 'a book', 'She has a book'), option('👜', 'a bag', 'She has a bag'),
  ]),
  fnd_v7_numbers_0_10: any(2, 'เลือกเลขที่คุณชอบแล้วพูดเป็นภาษาอังกฤษ', '', [
    option('3️⃣', 'three', 'three'), option('7️⃣', 'seven', 'seven'), option('9️⃣', 'nine', 'nine'),
  ]),
  fnd_v7_eleven_to_twenty: single(4, 'ตัวละครอายุสิบหกปี เลือกคำบอกอายุที่ถูกต้อง', 'She is...years old', 'She is sixteen years old', 'เลข 16 อ่านว่า sixteen ครับ', [
    option('1️⃣2️⃣', 'twelve', 'She is twelve years old'), option('1️⃣6️⃣', 'sixteen', 'She is sixteen years old'), option('2️⃣0️⃣', 'twenty', 'She is twenty years old'),
  ]),
  fnd_v7_letter_names_a_m: single(4, 'ชื่อ MIA ขึ้นต้นด้วยตัวอักษรอะไร', '', 'M', 'ชื่อ MIA ขึ้นต้นด้วย M ครับ', [
    option('🔤', 'M', 'M'), option('🔤', 'I', 'I'), option('🔤', 'A', 'A'),
  ]),
  fnd_v7_letter_names_n_z: single(4, 'ถ้าฟังชื่อไม่ชัด ควรขอให้อีกฝ่ายทำอะไร', 'Please...', 'Please spell that', 'ใช้ spell เมื่ออยากให้อีกฝ่ายสะกดคำครับ', [
    option('🔤', 'spell that', 'Please spell that'), option('🐢', 'speak slowly', 'Please speak slowly'), option('🔁', 'say again', 'Please say that again'),
  ]),
  fnd_v7_twenty_to_one_hundred: single(3, 'ห้องหมายเลขสี่สิบสอง เลือกคำเติมหลัง forty แล้วพูดหมายเลขเต็ม', 'forty-...', 'forty-two', '42 คือ forty ตามด้วย two ครับ', [
    option('1️⃣', 'one', 'forty-one'), option('2️⃣', 'two', 'forty-two'), option('5️⃣', 'five', 'forty-five'),
  ]),
  fnd_v7_what_time_is_it: single(2, 'นาฬิกาแสดงเวลา 8:30 เลือกคำบอกเวลาที่ตรง', 'It is...', 'It is eight thirty', '8:30 อ่านว่า eight thirty ครับ', [
    option('🕗', 'eight', 'It is eight'), option('🕣', 'eight thirty', 'It is eight thirty'), option('🕢', 'seven thirty', 'It is seven thirty'),
  ]),
  fnd_v7_days_and_simple_plans: any(3, 'เลือกวันที่คุณสะดวกมาเรียน', 'The class is on...', [
    option('1️⃣', 'Monday', 'The class is on Monday'), option('3️⃣', 'Wednesday', 'The class is on Wednesday'), option('5️⃣', 'Friday', 'The class is on Friday'),
  ]),
  fnd_v7_prices_and_paying: single(2, 'คุณอยากทราบราคาสินค้า เลือกวลีแล้วพูดให้ครบ', '', 'How much is it?', 'การถามราคาใช้ How much ครับ', [
    option('💰', 'how much', 'How much is it?'), option('🎫', 'one ticket', 'One ticket, please'),
  ]),
  fnd_v7_i_like_i_dont_like: any(2, 'เลือกสิ่งที่คุณชอบจริง ๆ', 'I like...', [
    option('💧', 'water', 'I like water'), option('🍵', 'tea', 'I like tea'), option('☕', 'coffee', 'I like coffee'),
    option('🍚', 'rice', 'I like rice'), option('🍜', 'noodles', 'I like noodles'), option('🍞', 'bread', 'I like bread'),
  ]),
  fnd_v7_do_you_like_it: any(1, 'เลือกสิ่งหนึ่งที่อยากถามอีกฝ่าย', 'Do you like...', [
    option('💧', 'water', 'Do you like water?'), option('🍵', 'tea', 'Do you like tea?'), option('☕', 'coffee', 'Do you like coffee?'),
    option('🍚', 'rice', 'Do you like rice?'), option('🍜', 'noodles', 'Do you like noodles?'), option('🍞', 'bread', 'Do you like bread?'),
  ]),
  fnd_v7_want_need_and_please: any(2, 'เลือกเครื่องดื่มที่คุณต้องการแล้วขออย่างสุภาพ', '...please', [
    option('☕', 'coffee', 'A coffee, please'), option('🍵', 'tea', 'Tea, please'), option('💧', 'water', 'Water, please'),
  ]),
  fnd_v7_i_can: any(2, 'เลือกสิ่งที่คุณทำได้', 'I can...', [
    option('🏊', 'swim', 'I can swim'), option('📖', 'read', 'I can read'), option('🍳', 'cook', 'I can cook'),
  ]),
  fnd_v7_cant_and_can_you: any(2, 'เลือกหนึ่งความสามารถเพื่อถามเพื่อน', 'Can you...', [
    option('🏊', 'swim', 'Can you swim?'), option('🍳', 'cook', 'Can you cook?'), option('📖', 'read', 'Can you read?'),
  ]),
  fnd_v7_my_day: any(2, 'เลือกกิจกรรมหนึ่งอย่างที่คุณทำทุกวัน แล้วพูดให้ครบประโยค', 'I...every day', [
    option('🌅', 'wake up', 'I wake up every day'), option('🍽️', 'eat', 'I eat every day'), option('📖', 'read', 'I read every day'),
  ]),
  fnd_v7_her_day_his_day: single(2, 'ประธานเป็นผู้ชายและกิจกรรมคือกิน ควรเลือกคำใด', 'He...', 'He eats', 'เมื่อประธานเป็น he ใช้ eats ครับ', [
    option('🍽️', 'eats', 'He eats'), option('💼', 'works', 'He works'), option('😴', 'sleeps', 'He sleeps'),
  ]),
  fnd_v7_do_does_every_day: single(2, 'คุณอยากถามว่าเขาทำงานไหม เลือกกิจกรรมแล้วถามเต็มประโยค', 'Does he...?', 'Does he work?', 'เลือก work และเริ่มถามด้วย Does he ครับ', [
    option('💼', 'work', 'Does he work?'), option('🍽️', 'eat', 'Does he eat?'),
  ]),
  fnd_v7_happening_now: any(2, 'สมมติว่าตัวละครหญิงกำลังทำกิจกรรมหนึ่งอย่าง คุณเลือกได้เองว่าเป็นอะไร', 'She is...', [
    option('📖', 'reading', 'She is reading'), option('🍳', 'cooking', 'She is cooking'), option('🍽️', 'eating', 'She is eating'),
  ]),
  fnd_v7_are_they_working: single(2, 'อยากถามว่าคนกลุ่มนั้นกำลังกินอยู่ไหม เลือกกิจกรรมแล้วถาม', 'Are they...?', 'Are they eating?', 'เลือก eating และใช้ Are they ครับ', [
    option('💼', 'working', 'Are they working?'), option('🍽️', 'eating', 'Are they eating?'),
  ]),
  fnd_v7_what_or_who: single(1, 'คุณชี้ไปที่สิ่งของและอยากรู้ว่าคืออะไร', '...is this?', 'What is this?', 'สิ่งของใช้คำถาม What ครับ', [
    option('📦', 'what', 'What is this?'), option('👤', 'who', 'Who is this?'),
  ]),
  fnd_v7_where_when_how_much_and_how_many: single(2, 'คุณอยากทราบว่าคลาสเริ่มเมื่อไร', '...is the class?', 'When is the class?', 'การถามเวลาใช้ When ครับ', [
    option('📍', 'where', 'Where is the class?'), option('📅', 'when', 'When is the class?'),
  ]),
  fnd_v7_there_is_there_are: single(2, 'ในห้องมีเก้าอี้สองตัว ควรใช้รูปใด', 'There...', 'There are two chairs', 'หลายชิ้นใช้ There are ครับ', [
    option('1️⃣', 'is', 'There is a chair'), option('2️⃣', 'are', 'There are two chairs'),
  ]),
  fnd_v7_in_on_under_next_to: single(2, 'กระเป๋าอยู่ใต้เตียง เลือกคำบอกตำแหน่ง', 'The bag is...the bed', 'The bag is under the bed', 'อยู่ใต้ใช้ under ครับ', [
    option('⬆️', 'on', 'The bag is on the bed'), option('⬇️', 'under', 'The bag is under the bed'), option('↔️', 'next to', 'The bag is next to the bed'),
  ]),
  fnd_v7_go_straight_turn_left: single(2, 'ทางไปห้องอยู่ด้านซ้าย ควรบอกให้ทำอะไร', '', 'Turn left', 'ด้านซ้ายใช้ Turn left ครับ', [
    option('⬆️', 'go straight', 'Go straight'), option('⬅️', 'turn left', 'Turn left'), option('➡️', 'turn right', 'Turn right'),
  ]),
  fnd_v7_where_is_it: single(2, 'คุณอยากรู้ว่าสถานีอยู่ที่ไหน ควรถามอย่างไร', 'Where is...?', 'Where is the station?', 'ถามหาสถานที่ใช้ Where is ครับ', [
    option('🚉', 'station', 'Where is the station?'), option('🏥', 'hospital', 'Where is the hospital?'), option('🛍️', 'market', 'Where is the market?'),
  ]),
  fnd_v7_how_do_you_go: any(2, 'เลือกวิธีเดินทางหนึ่งอย่างแล้วบอกให้ครบประโยค', 'I go by...', [
    option('🚌', 'bus', 'I go by bus'), option('🚆', 'train', 'I go by train'), option('🚕', 'taxi', 'I go by taxi'),
  ]),
};
