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
  fnd_v7_please_and_thank_you: single(3, 'คราวนี้คุณเผลอเหยียบเท้าเพื่อนครับ จะพูดอะไรกับเขา?', '', 'Sorry.', 'เผลอเหยียบเท้าเพื่อนแล้วใช้ Sorry. ครับ', [
    option('😔', 'Sorry', 'Sorry.'), option('💝', 'Thank you', 'Thank you.'),
  ]),
  fnd_v7_say_that_again: single(2, 'อีกฝ่ายพูดเร็วเกินไป คุณควรขออย่างไร', 'Please...', 'Please speak slowly', 'เลือกคำที่ขอให้พูดช้าลงครับ', [
    option('🔁', 'say again', 'Please say that again'), option('🐢', 'speak slowly', 'Please speak slowly'),
  ]),
  fnd_v7_goodbye_see_you: any(2, 'ลองสมมติว่าคุณกำลังจะกลับบ้านครับ เลือกคำลาที่อยากพูดกับครูได้เลย', '', [
    option('👋', 'Goodbye', 'Goodbye.'), option('🙂', 'See you', 'See you.'),
  ]),
  fnd_v7_i_am_you_are: any(2, 'ลองเลือกบอกความรู้สึกของตัวเองหนึ่งอย่าง จะตอบตามจริงหรือสมมติก็ได้ครับ', 'I am ...', [
    option('😊', 'happy', 'I am happy'), option('😴', 'tired', 'I am tired'), option('🍽️', 'hungry', 'I am hungry'), option('✅', 'ready', 'I am ready'),
  ]),
  fnd_v7_not_and_are_you: any(3, 'คราวนี้ตอบตามตัวเองได้เลย', '', [
    option('🙂', 'Yes', 'Yes, I am.'), option('🙅', 'No', 'No, I am not.'),
  ]),
  fnd_v7_he_she_it_we_they: single(2, 'คุณกำลังพูดถึงนักเรียนอีกกลุ่มหนึ่งที่ไม่มีคุณอยู่ด้วย', '... are students.', 'They are students.', 'กลุ่มนี้ไม่มีคุณ ใช้ They ครับ', [
    option('🫵', 'We', 'We are students.'), option('👉', 'They', 'They are students.'),
  ]),
  fnd_v7_my_family: any(2, 'เลือกแนะนำสมาชิกหนึ่งคนได้เลยครับ', 'This is my ...', [
    option('👩', 'mother', 'This is my mother.'), option('👨', 'father', 'This is my father.'), option('👧', 'sister', 'This is my sister.'), option('👦', 'brother', 'This is my brother.'),
  ]),
  fnd_v7_one_or_more: single(2, 'คราวนี้มีแอปเปิลแค่หนึ่งลูกครับ', '', 'an apple', 'หนึ่งลูกใช้ an apple ครับ', [
    option('🍎', 'an apple', 'an apple'), option('🍎🍎', 'apples', 'apples'),
  ]),
  fnd_v7_this_is_that_is: single(2, 'มีกระเป๋าอยู่ไกลอีกฝั่งห้องครับ', '... is a bag.', 'That is a bag.', 'ของไกลใช้ That ครับ', [
    option('👇', 'This', 'This is a bag.'), option('👉', 'That', 'That is a bag.'),
  ]),
  fnd_v7_colours_and_size: any(2, 'เลือกสีให้กระเป๋าของคุณหนึ่งสี', 'It is ...', [
    option('🔴', 'red', 'It is red.'), option('🔵', 'blue', 'It is blue.'), option('🟢', 'green', 'It is green.'),
  ]),
  fnd_v7_these_and_those: single(2, 'กระเป๋าหลายใบอยู่ไกลอีกฝั่งห้องครับ', '... are bags.', 'Those are bags.', 'ของหลายชิ้นที่อยู่ไกลใช้ Those ครับ', [
    option('👇', 'These', 'These are bags.'), option('👉', 'Those', 'Those are bags.'),
  ]),
  fnd_v7_my_and_your: any(2, 'เลือกของหนึ่งชิ้นแล้วบอกว่าเป็นของคุณเองครับ', 'This is my ...', [
    option('📱', 'phone', 'This is my phone.'), option('🎒', 'bag', 'This is my bag.'), option('🔑', 'key', 'This is my key.'),
  ]),
  fnd_v7_his_her_our_their: single(2, 'กระเป๋าเป็นของ Ben ซึ่งเป็นผู้ชาย', 'This is ... bag.', 'This is his bag.', 'Ben เป็นผู้ชาย ใช้ his ครับ', [
    option('👨', 'his', 'This is his bag.'), option('👩', 'her', 'This is her bag.'),
  ]),
  fnd_v7_have_and_has: any(2, 'เลือกของที่คุณมีหนึ่งอย่างครับ', 'I have a ...', [
    option('📖', 'book', 'I have a book.'), option('📱', 'phone', 'I have a phone.'), option('🎒', 'bag', 'I have a bag.'),
  ]),
  fnd_v7_numbers_0_10: any(2, 'เลือกเลขที่ชอบหนึ่งเลขครับ', '', [
    option('3️⃣', 'three', 'three'), option('5️⃣', 'five', 'five'), option('8️⃣', 'eight', 'eight'), option('🔟', 'ten', 'ten'),
  ]),
  fnd_v7_eleven_to_twenty: single(2, 'ห้องหมายเลข 14 อ่านอย่างไร', '', 'fourteen', 'ห้อง 14 อ่านว่า fourteen ครับ', [
    option('1️⃣3️⃣', 'thirteen', 'thirteen'), option('1️⃣4️⃣', 'fourteen', 'fourteen'), option('1️⃣5️⃣', 'fifteen', 'fifteen'),
  ]),
  fnd_v7_letter_names_a_m: single(4, 'ชื่อ MIA ขึ้นต้นด้วยตัวอักษรอะไร', '', 'M', 'ชื่อ MIA ขึ้นต้นด้วย M ครับ', [
    option('🔤', 'M', 'M'), option('🔤', 'I', 'I'), option('🔤', 'A', 'A'),
  ]),
  fnd_v7_letter_names_n_z: single(4, 'ถ้าฟังชื่อไม่ชัด ควรขอให้อีกฝ่ายทำอะไร', 'Please...', 'Please spell that', 'ใช้ spell เมื่ออยากให้อีกฝ่ายสะกดคำครับ', [
    option('🔤', 'spell that', 'Please spell that'), option('🐢', 'speak slowly', 'Please speak slowly'), option('🔁', 'say again', 'Please say that again'),
  ]),
  fnd_v7_twenty_to_one_hundred: single(2, 'ป้ายราคาเขียนว่า 50 บาทครับ', '', 'fifty', 'ป้ายราคา 50 อ่านว่า fifty ครับ', [
    option('3️⃣0️⃣', 'thirty', 'thirty'), option('4️⃣0️⃣', 'forty', 'forty'), option('5️⃣0️⃣', 'fifty', 'fifty'),
  ]),
  fnd_v7_what_time_is_it: single(2, 'นาฬิกาแสดง 8:30 ครับ', 'It is ...', 'It is eight thirty.', '8:30 พูดว่า It is eight thirty. ครับ', [
    option('🕗', 'eight', 'It is eight.'), option('🕣', 'eight thirty', 'It is eight thirty.'),
  ]),
  fnd_v7_days_and_simple_plans: any(3, 'ลองเลือกวันให้คลาสสมมติของคุณครับ', 'The class is on ...', [
    option('1️⃣', 'Monday', 'The class is on Monday.'), option('2️⃣', 'Tuesday', 'The class is on Tuesday.'), option('3️⃣', 'Wednesday', 'The class is on Wednesday.'), option('4️⃣', 'Thursday', 'The class is on Thursday.'),
  ]),
  fnd_v7_prices_and_paying: single(2, 'ป้ายราคาใหม่คือ 30 บาทครับ', 'It is ... baht.', 'It is thirty baht.', '30 ใช้ thirty ครับ', [
    option('3️⃣0️⃣', 'thirty', 'It is thirty baht.'), option('4️⃣0️⃣', 'forty', 'It is forty baht.'),
  ]),
  fnd_v7_i_like_i_dont_like: any(2, 'พูดเรื่องชาตามความชอบของคุณครับ', 'I ... tea.', [
    option('🙂', 'like', 'I like tea.'), option('🙅', "don't like", "I don't like tea."),
  ]),
  fnd_v7_do_you_like_it: any(1, 'ตอบตามตัวเองได้เลยครับ Do you like tea?', '', [
    option('🙂', 'Yes', 'Yes, I do.'), option('🙅', 'No', "No, I don't."),
  ]),
  fnd_v7_want_need_and_please: any(2, 'เลือกเครื่องดื่มแล้วขออย่างสุภาพครับ', '..., please.', [
    option('💧', 'water', 'Water, please.'), option('🍵', 'tea', 'Tea, please.'), option('☕', 'coffee', 'Coffee, please.'),
  ]),
  fnd_v7_i_can: any(2, 'เลือกสิ่งที่ทำได้หนึ่งอย่างครับ', 'I can ...', [
    option('🏊', 'swim', 'I can swim.'), option('📖', 'read', 'I can read.'), option('🍳', 'cook', 'I can cook.'),
  ]),
  fnd_v7_cant_and_can_you: any(2, 'ตอบตามตัวเองครับ Can you cook?', '', [
    option('🙂', 'Yes', 'Yes, I can.'), option('🙅', 'No', "No, I can't."),
  ]),
  fnd_v7_my_day: any(2, 'เลือกกิจกรรมที่ทำทุกวันหนึ่งอย่างครับ', 'I ... every day.', [
    option('📖', 'read', 'I read every day.'), option('🍳', 'cook', 'I cook every day.'), option('💼', 'work', 'I work every day.'),
  ]),
  fnd_v7_her_day_his_day: single(2, 'ลองบอกว่าเขากินครับ', 'He ...', 'He eats.', 'พูดถึง he ใช้ eats ครับ', [
    option('🍽️', 'eat', 'He eat.'), option('🍽️', 'eats', 'He eats.'),
  ]),
  fnd_v7_do_does_every_day: single(2, 'ถามครูเกี่ยวกับ Ben ว่าเขาทำงานทุกวันไหม', '... he work every day?', 'Does he work every day?', 'ถามถึงผู้ชายอีกคนใช้ Does ครับ', [
    option('🗣️', 'Do', 'Do you work every day?'), option('👉', 'Does', 'Does he work every day?'),
  ]),
  fnd_v7_happening_now: any(2, 'เลือกสิ่งที่ตัวละครของคุณกำลังทำตอนนี้ครับ', 'I am ...', [
    option('📖', 'reading', 'I am reading.'), option('🍳', 'cooking', 'I am cooking.'),
  ]),
  fnd_v7_are_they_working: single(2, 'ลองถามถึง Anna อีกครั้งครับ', '... she working?', 'Is she working?', 'ถาม she ใช้ Is ครับ', [
    option('👉', 'Is', 'Is she working?'), option('👥', 'Are', 'Are she working?'),
  ]),
  fnd_v7_what_or_who: single(1, 'มีคนอยู่ข้างครูและคุณอยากรู้ว่าเป็นใครครับ', '... is this?', 'Who is this?', 'คนใช้ Who ครับ', [
    option('📦', 'What', 'What is this?'), option('👤', 'Who', 'Who is this?'),
  ]),
  fnd_v7_where_when_how_much_and_how_many: single(2, 'คุณอยากรู้ราคาของกระเป๋าครับ', '', 'How much is it?', 'ถามราคาใช้ How much ครับ', [
    option('🏷️', 'How much', 'How much is it?'), option('🔢', 'How many', 'How many bags?'),
  ]),
  fnd_v7_there_is_there_are: single(2, 'ในห้องมีเก้าอี้สองตัวครับ', 'There ... two chairs.', 'There are two chairs.', 'หลายตัวใช้ are ครับ', [
    option('1️⃣', 'is', 'There is two chairs.'), option('2️⃣', 'are', 'There are two chairs.'),
  ]),
  fnd_v7_in_on_under_next_to: single(2, 'หนังสืออยู่ข้างกระเป๋าครับ', 'The book is ... the bag.', 'The book is next to the bag.', 'ข้างกระเป๋าใช้ next to ครับ', [
    option('📥', 'in', 'The book is in the bag.'), option('↔️', 'next to', 'The book is next to the bag.'),
  ]),
  fnd_v7_go_straight_turn_left: single(2, 'Max ต้องเลี้ยวขวาที่ทางแยกครับ', '', 'Turn right.', 'เลี้ยวขวาใช้ Turn right. ครับ', [
    option('⬆️', 'straight', 'Go straight.'), option('↩️', 'left', 'Turn left.'), option('↪️', 'right', 'Turn right.'),
  ]),
  fnd_v7_where_is_it: any(2, 'เลือกสถานที่ที่คุณอยากถามหาในสถานการณ์นี้ครับ', 'Where is the ...?', [
    option('🏫', 'school', 'Where is the school?'), option('☕', 'café', 'Where is the café?'), option('🛍️', 'shop', 'Where is the shop?'),
  ]),
  fnd_v7_how_do_you_go: any(2, 'เลือกวิธีเดินทางสำหรับทริปสมมติแล้วพูดประโยคเต็มครับ', 'I go by ...', [
    option('🚌', 'bus', 'I go by bus.'), option('🚆', 'train', 'I go by train.'), option('🚕', 'taxi', 'I go by taxi.'),
  ]),
};
