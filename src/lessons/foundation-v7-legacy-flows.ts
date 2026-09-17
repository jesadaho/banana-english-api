import type { V7TeachingStep } from './foundation-v7-lessons.data';
const icons: Record<string, string> = { coffee: '☕', tea: '🍵', water: '💧', rice: '🍚', noodles: '🍜', bread: '🍞', Please: '🙏', 'Thank you': '💝', Sorry: '😔', 'Excuse me': '🙋', 'Please say that again': '🔁', 'Please speak slowly': '🐢', 'I do not understand': '🤔' };

// V1 pacing: teach a small chunk, use it immediately, then transfer it.
const task = (text: string, expectedSpeech: string, labels: string[] = [], stem = '', any = false, successText?: string): V7TeachingStep => ({
  kind: 'recall', instruction: text, expectsUserSpeech: true, expectedSpeech,
  presentation: { text, answerMode: any ? 'any' : 'single', options: labels.map(label => ({
    emoji: icons[label] ?? '🔢', label, speak: stem + label,
  })), stem, successText },
});
const choiceTask = (
  text: string,
  expectedSpeech: string,
  stem: string,
  options: Array<{ emoji: string; label: string; speak: string }>,
  successText?: string,
  any = false,
): V7TeachingStep => ({
  kind: 'recall', instruction: text, expectsUserSpeech: true, expectedSpeech,
  presentation: { text, answerMode: any ? 'any' : 'single', options, stem, successText },
});
const finish = (text: string): V7TeachingStep => ({ kind: 'complete', instruction: text,
  expectsUserSpeech: false, presentation: { text, answerMode: 'single', options: [], stem: '' } });
const reuseTask = (text: string, fallback: string, successText?: string): V7TeachingStep => ({
  kind: 'recall', instruction: 'Choice reuse: ' + text, expectsUserSpeech: true, expectedSpeech: fallback,
  presentation: { text, answerMode: 'single', options: [], stem: '', successText },
});

export const V7_LEGACY_FLOWS: Record<string, V7TeachingStep[]> = {
  fnd_v7_he_she_it_we_they: [
    task('วันนี้ในห้องมี Ben, Anna, กระเป๋าหนึ่งใบ และเพื่อนอีกหลายคนครับ เรียกชื่อทุกครั้งคงเหนื่อยน่าดู 😅 เราจะฝึกใช้คำสั้น ๆ แทนคน สิ่งของ และกลุ่มกัน Ben เป็นเพื่อนร่วมชั้นของคุณครับ 👨 ถ้าพูดถึงผู้ชายหนึ่งคน ใช้ he ลองพูดว่า “He is my classmate.”', 'He is my classmate.', [], '', false,
      'เยี่ยมมากครับ “He is my classmate.” แปลว่า “เขาเป็นเพื่อนร่วมชั้นของฉัน” ต่อไป '),
    choiceTask('Anna เป็นครูของ Ben ครับ 👩‍🏫 Anna เป็นผู้หญิงหนึ่งคน ควรเริ่มด้วยคำไหนครับ?', 'She is his teacher.', '... is his teacher.', [
      { emoji: '👨', label: 'He', speak: 'He is his teacher.' },
      { emoji: '👩‍🏫', label: 'She', speak: 'She is his teacher.' },
    ], 'ถูกต้องครับ “She is his teacher.” แปลว่า “เธอเป็นครูของเขา” ต่อไปเราจะพูดถึงสิ่งของครับ '),
    task('กระเป๋าใบนี้เป็นของ Ben ครับ 🎒 เวลาพูดถึงสิ่งของหนึ่งชิ้น ใช้ it ลองพูดว่า “It is his bag.”', 'It is his bag.', [], '', false,
      'ดีมากครับ “It is his bag.” แปลว่า “มันคือกระเป๋าของเขา” ต่อไปลองเลือกคำจากสถานการณ์ครับ '),
    choiceTask('Teacher B กำลังพูดถึง Anna ครับ 👩 Anna ใจดี ควรเริ่มด้วยคำไหน?', 'She is kind.', '... is kind.', [
      { emoji: '👨', label: 'He', speak: 'He is kind.' },
      { emoji: '👩', label: 'She', speak: 'She is kind.' },
      { emoji: '🎒', label: 'It', speak: 'It is kind.' },
    ], 'ถูกต้องครับ เราใช้ she เพราะกำลังพูดถึง Anna ต่อไปมาพูดถึงกลุ่มที่มีตัวเราครับ '),
    task('คุณกับ Ben อยู่ห้องเรียนเดียวกันครับ 🫵👨 เมื่อกลุ่มนั้นมีตัวเรารวมอยู่ด้วย ใช้ we ลองพูดว่า “We are classmates.”', 'We are classmates.', [], '', false,
      'เยี่ยมครับ we คือกลุ่มที่มีตัวเรารวมอยู่ด้วย ต่อไปเป็นกลุ่มอื่นครับ '),
    task('Anna กับ Ben ยืนอยู่อีกฝั่งหนึ่งครับ 👉👩👨 กลุ่มนี้ไม่มีตัวเรารวมอยู่ด้วย ใช้ they ลองพูดว่า “They are friends.”', 'They are friends.', [], '', false,
      'ถูกต้องครับ they ใช้กับคนกลุ่มอื่นที่ไม่มีตัวเรารวมอยู่ด้วย ขั้นสุดท้ายลองแยก we กับ they ครับ '),
    choiceTask('คุณอยู่กับเพื่อนสองคนครับ 🫵👥 ทุกคนเป็นนักเรียน ควรใช้ We หรือ They?', 'We are students.', '... are students.', [
      { emoji: '🫵👥', label: 'We', speak: 'We are students.' },
      { emoji: '👉👥', label: 'They', speak: 'They are students.' },
    ], 'ถูกต้องครับ กลุ่มนี้มีตัวคุณอยู่ด้วยจึงใช้ we '),
    finish('จบบทแล้วครับ วันนี้คุณใช้ he, she, it, we และ they ตามคน สิ่งของ และกลุ่มในสถานการณ์ครับ'),
  ],
  fnd_v7_my_family: [
    task('Max เปิดอัลบั้มครอบครัวให้เราดูครับ 👨‍👩‍👧 วันนี้เราจะเรียนคำเรียกสมาชิกครอบครัวและฝึกแนะนำพวกเขา คนแรกคือแม่ของ Max คำว่า “แม่” คือ mother ลองพูดคำว่า “mother”', 'mother', [], '', false,
      'ดีครับ mother แปลว่าแม่ ต่อไปเป็นคำว่าพ่อครับ '),
    choiceTask('father แปลว่าพ่อครับ 👨 ถ้าคำที่ต้องการคือ “พ่อ” เลือกคำแล้วพูดครับ', 'father', '', [
      { emoji: '👩', label: 'mother', speak: 'mother' }, { emoji: '👨', label: 'father', speak: 'father' },
    ], 'ถูกต้องครับ father แปลว่าพ่อ ต่อไปลองใช้คำนี้แนะนำคนครับ '),
    task('ถ้าจะแนะนำว่า “นี่คือแม่ของฉัน” พูดว่า “This is my mother.” ลองพูดตามครับ', 'This is my mother.', [], '', false,
      'เยี่ยมครับ This is my... ใช้แนะนำสมาชิกครอบครัว ต่อไปเรียนอีกสองคำครับ '),
    choiceTask('brother คือพี่ชายหรือน้องชาย 👦 sister คือพี่สาวหรือน้องสาว 👧 คำว่า “พี่สาวหรือน้องสาว” คือคำไหนครับ?', 'sister', '', [
      { emoji: '👦', label: 'brother', speak: 'brother' }, { emoji: '👧', label: 'sister', speak: 'sister' },
    ], 'ถูกต้องครับ sister คือพี่สาวหรือน้องสาว ต่อไปนำคำศัพท์ไปใช้ในประโยคครับ '),
    choiceTask('Max กำลังแนะนำพี่ชายครับ 👦 เติมคำเดียวแล้วพูดประโยคเต็ม', 'This is my brother.', 'This is my ...', [
      { emoji: '👦', label: 'brother', speak: 'This is my brother.' },
      { emoji: '👧', label: 'sister', speak: 'This is my sister.' },
    ], 'ดีมากครับ คราวนี้เลือกสมาชิกที่คุณอยากแนะนำเองครับ '),
    choiceTask('เลือกสมาชิกครอบครัวหนึ่งคนที่คุณอยากแนะนำครับ จะเป็นข้อมูลจริงหรือสมมติก็ได้', 'This is my mother.', 'This is my ...', [
      { emoji: '👩', label: 'mother', speak: 'This is my mother.' },
      { emoji: '👨', label: 'father', speak: 'This is my father.' },
      { emoji: '👦', label: 'brother', speak: 'This is my brother.' },
      { emoji: '👧', label: 'sister', speak: 'This is my sister.' },
    ], 'ขอบคุณที่แนะนำครับ ลองพูดประโยคเดิมอีกครั้งโดยไม่ดูตัวช่วยครับ ', true),
    reuseTask('พูดประโยคแนะนำสมาชิกที่คุณเลือกเมื่อกี้อีกครั้งโดยไม่ดูตัวช่วยครับ', 'This is my mother.',
      'เยี่ยมครับ คุณนำคำศัพท์ครอบครัวไปใช้แนะนำคนได้แล้ว '),
    finish('จบบทแล้วครับ วันนี้คุณได้รู้จัก mother, father, brother และ sister และใช้ This is my... เพื่อแนะนำสมาชิกครอบครัวครับ'),
  ],
  fnd_v7_what_or_who: [
    task('คุณเจอคนไม่รู้จักหนึ่งคนกับกล่องปริศนาหนึ่งใบครับ ถามสลับกันอาจฟังแปลกนิดหน่อย 😅 วันนี้เราจะฝึกใช้ what ถามสิ่งของ และ who ถามคน เริ่มจากของชิ้นนี้ครับ 📦❓ ลองพูดว่า “What is this?”', 'What is this?', [], '', false,
      'ดีมากครับ “What is this?” ใช้ถามว่าสิ่งนี้คืออะไร ต่อไปลองเลือกคำถามจากสถานการณ์ครับ '),
    choiceTask('มีของวางอยู่บนโต๊ะครับ ☕❓ คุณไม่รู้ว่ามันคืออะไร ควรเริ่มด้วย What หรือ Who?', 'What is this?', '... is this?', [
      { emoji: '📦', label: 'What', speak: 'What is this?' },
      { emoji: '👤', label: 'Who', speak: 'Who is this?' },
    ], 'ถูกต้องครับ Teacher B ตอบว่า “It is coffee.” ต่อไปเราจะถามเกี่ยวกับคนครับ '),
    task('มีคนโทรเข้ามา แต่คุณไม่รู้ว่าเป็นใครครับ 📞👤 ใช้ who ถามคน ลองพูดว่า “Who is that?”', 'Who is that?', [], '', false,
      'เยี่ยมครับ “Who is that?” ใช้ถามว่าคนนั้นคือใคร ต่อไปลองเลือกเองครับ '),
    choiceTask('มีคนยืนรออยู่หน้าห้องครับ 🚪👤❓ คุณอยากรู้ว่าเขาคือใคร ควรเริ่มด้วยคำไหน?', 'Who is that?', '... is that?', [
      { emoji: '📦', label: 'What', speak: 'What is that?' },
      { emoji: '👤', label: 'Who', speak: 'Who is that?' },
    ], 'ถูกต้องครับ Teacher B ตอบว่า “That is Max.” ขั้นสุดท้ายลองถามเรื่องสิ่งของโดยไม่มีตัวช่วยครับ '),
    task('คุณเจอสิ่งของที่ไม่รู้จักครับ 🎁❓ ลองถามว่าสิ่งนี้คืออะไรโดยไม่มีตัวช่วย', 'What is this?', [], '', false,
      'ถูกต้องครับ คุณแยกคำถามเกี่ยวกับคนและสิ่งของได้ตามสถานการณ์แล้ว '),
    finish('จบบทแล้วครับ วันนี้คุณใช้ what ถามสิ่งของ และ who ถามคนครับ'),
  ],
  fnd_v7_where_when_how_much_and_how_many: [
    task('Max บอกแค่ว่า “เจอกันที่ตลาดนะ” แต่เรายังไม่รู้ว่าที่ไหนหรือเมื่อไรครับ 😅 วันนี้เราจะฝึกถามสถานที่ เวลา ราคา และจำนวนให้ตรงกับข้อมูลที่ต้องการ เริ่มจากถามสถานที่ด้วย where ครับ 🛍️📍 ลองพูดว่า “Where is the market?”', 'Where is the market?', [], '', false,
      'ดีครับ Max ตอบว่า “Near the station.” ตอนนี้รู้สถานที่แล้ว แต่ยังไม่รู้วันครับ '),
    task('คุณอยากรู้ว่าจะไปเมื่อไรครับ 📅❓ ใช้ when ถามเวลา ลองพูดว่า “When do we go?”', 'When do we go?', [], '', false,
      'เยี่ยมครับ Max ตอบว่า “On Saturday.” เมื่อไปถึงตลาด คุณเจอของที่ไม่มีป้ายราคาครับ '),
    choiceTask('คุณหยิบน้ำหนึ่งขวด แต่ไม่รู้ราคาครับ 💧🏷️❓ ควรเริ่มด้วยคำไหน?', 'How much is it?', '... is it?', [
      { emoji: '📍', label: 'Where', speak: 'Where is it?' },
      { emoji: '📅', label: 'When', speak: 'When is it?' },
      { emoji: '🏷️', label: 'How much', speak: 'How much is it?' },
    ], 'ถูกต้องครับ พนักงานตอบว่า “It is twenty baht.” ต่อไป Max ต้องการน้ำหลายขวดครับ '),
    task('คุณไม่รู้ว่า Max ต้องการน้ำกี่ขวดครับ 💧💧❓ ใช้ how many ถามจำนวน ลองพูดว่า “How many bottles?”', 'How many bottles?', [], '', false,
      'ดีมากครับ Max ตอบว่า “Two bottles.” ต่อไปลองแยกหน้าที่ของคำถามครับ '),
    choiceTask('คุณรู้ว่าสินค้าคืออะไรแล้ว แต่อยากรู้ “ราคา” ครับ 🏷️ ควรถามแบบไหน?', 'How much is it?', '', [
      { emoji: '📍', label: 'Where', speak: 'Where is it?' },
      { emoji: '📅', label: 'When', speak: 'When is it?' },
      { emoji: '🏷️', label: 'How much', speak: 'How much is it?' },
      { emoji: '🔢', label: 'How many', speak: 'How many?' },
    ], 'ถูกต้องครับ how much ใช้ถามราคา ขั้นสุดท้ายลองถามจำนวนโดยไม่มีตัวช่วยครับ '),
    task('คุณรู้ราคาตั๋วแล้ว แต่ไม่รู้ว่าต้องซื้อตั๋วกี่ใบครับ 🎫🎫❓ ลองถามเอง', 'How many tickets?', [], '', false,
      'เยี่ยมครับ คุณเลือกคำถามตามข้อมูลที่ต้องการได้แล้ว '),
    finish('จบบทแล้วครับ วันนี้คุณใช้ where ถามสถานที่ when ถามเวลา how much ถามราคา และ how many ถามจำนวนครับ'),
  ],
  fnd_v7_do_does_every_day: [
    task('Teacher B บอกว่าทำงานทุกวันครับ…เราจะเชื่อเลยหรือถามยืนยันดีนะ 😄 วันนี้เราจะฝึกถามกิจวัตรของคนตรงหน้าและบุคคลอื่น ถ้าอยากถาม Teacher B ว่า “คุณทำงานทุกวันไหม” ใช้ Do you... ลองพูดว่า “Do you work every day?”', 'Do you work every day?', [], '', false,
      'ดีครับ Teacher B ตอบว่า “Yes, I do.” ต่อไปเลือกกิจกรรมที่คุณอยากถามเองครับ '),
    choiceTask('เลือกหนึ่งกิจกรรมที่คุณอยากถาม Teacher B ครับ ทุกคำตอบใช้ได้', 'Do you work every day?', 'Do you ... every day?', [
      { emoji: '💼', label: 'work', speak: 'Do you work every day?' },
      { emoji: '📖', label: 'read', speak: 'Do you read every day?' },
      { emoji: '🍳', label: 'cook', speak: 'Do you cook every day?' },
    ], 'Teacher B ตอบคำถามของคุณแล้วครับ ต่อไปเราจะถามถึง Max ซึ่งไม่ได้อยู่ในบทสนทนานี้ ' , true),
    task('เมื่อถามเรื่อง Max ใช้ Does he... ครับ 👨 ลองพูดว่า “Does he study every day?”', 'Does he study every day?', [], '', false,
      'ถูกต้องครับ Teacher B ตอบว่า “Yes, he does.” ต่อไปลองถามถึง May ครับ '),
    choiceTask('May อ่านหนังสือทุกวันครับ 👩📖 ลองถาม Teacher B เพื่อยืนยันข้อมูล', 'Does she read every day?', 'Does she ... every day?', [
      { emoji: '📖', label: 'read', speak: 'Does she read every day?' },
      { emoji: '🍳', label: 'cook', speak: 'Does she cook every day?' },
    ], 'ดีครับ Teacher B ตอบว่า “Yes, she does.” ต่อไปสังเกตว่าเรากำลังถามใครครับ '),
    choiceTask('คุณกำลังพูดกับ Ben โดยตรงครับ 👨🍳 ถามเขาว่าเขาทำอาหารทุกวันไหม ควรเริ่มด้วยแบบไหน?', 'Do you cook every day?', '... cook every day?', [
      { emoji: '🗣️', label: 'Do you', speak: 'Do you cook every day?' },
      { emoji: '👉👨', label: 'Does he', speak: 'Does he cook every day?' },
    ], 'ถูกต้องครับ เมื่อถาม Ben ตรง ๆ ใช้ you จึงเริ่มด้วย Do you ขั้นสุดท้ายเลือกถาม Teacher B อีกหนึ่งคำถามครับ '),
    choiceTask('เลือกถาม Teacher B เกี่ยวกับกิจวัตรหนึ่งอย่างครับ ทุกคำตอบใช้ได้', 'Do you work every day?', 'Do you ... every day?', [
      { emoji: '💼', label: 'work', speak: 'Do you work every day?' },
      { emoji: '📖', label: 'read', speak: 'Do you read every day?' },
      { emoji: '🍳', label: 'cook', speak: 'Do you cook every day?' },
      { emoji: '📚', label: 'study', speak: 'Do you study every day?' },
    ], 'Teacher B ตอบคำถามของคุณแล้วครับ ', true),
    finish('จบบทแล้วครับ เวลาถามคนตรงหน้าใช้ Do you...? และเวลาถามถึงผู้ชายหรือผู้หญิงอีกคนใช้ Does he...? หรือ Does she...? ครับ'),
  ],
  fnd_v7_go_straight_turn_left: [
    task('Max ออกจากคาเฟ่แล้วหาสถานีไม่เจอครับ ถ้าบอกผิดทาง กาแฟแก้วต่อไปอาจเย็นพอดี ☕😅 วันนี้เราจะฝึกบอกทางหนึ่งถึงสองขั้น ขั้นแรกต้องเดินตรงไป ลองพูดว่า “Go straight.”', 'Go straight.', [], '', false,
      'ดีครับ Max เดินตรงมาถึงทางแยกแล้ว สถานีอยู่ทางซ้ายครับ '),
    task('เมื่อสถานีอยู่ทางซ้าย ↩️ บอกว่า “Turn left.” ลองพูดตามครับ', 'Turn left.', [], '', false,
      'เยี่ยมครับ Max เลี้ยวซ้ายแล้วมาถึงอีกทางแยกครับ '),
    choiceTask('สถานีอยู่ทางขวาครับ ↪️🚉 ควรบอกทางว่าอะไร?', 'Turn right.', '', [
      { emoji: '⬆️', label: 'straight', speak: 'Go straight.' },
      { emoji: '↩️', label: 'left', speak: 'Turn left.' },
      { emoji: '↪️', label: 'right', speak: 'Turn right.' },
    ], 'ถูกต้องครับ Max เลี้ยวขวาและหันมาถูกถนนแล้ว ตอนนี้สถานีอยู่ตรงไปข้างหน้าครับ '),
    choiceTask('สถานีอยู่ตรงไปข้างหน้าครับ ⬆️🚉 เลือกคำสั่งที่ถูกต้องแล้วพูด', 'Go straight.', '', [
      { emoji: '⬆️', label: 'straight', speak: 'Go straight.' },
      { emoji: '↩️', label: 'left', speak: 'Turn left.' },
      { emoji: '↪️', label: 'right', speak: 'Turn right.' },
    ], 'ดีมากครับ Max ไปถึงสถานีแล้ว ต่อไปลองเชื่อมคำสั่งสองขั้นครับ '),
    task('นักท่องเที่ยวต้องเดินตรง แล้วเลี้ยวซ้ายครับ ⬆️↩️ ใช้ then เชื่อมสองขั้น ลองพูดว่า “Go straight, then turn left.”', 'Go straight, then turn left.', [], '', false,
      'เยี่ยมครับ ขั้นสุดท้ายลองเปลี่ยนปลายทางและทิศทางโดยไม่มีตัวช่วยครับ '),
    task('คุณกำลังบอกทางไปโรงแรมครับ 🏨 ขั้นแรกเดินตรง ⬆️ แล้วเลี้ยวขวา ↪️ ลองบอกสองขั้นเอง', 'Go straight, then turn right.', [], '', false,
      'ถูกต้องครับ นักท่องเที่ยวตอบว่า “Thank you!” '),
    finish('จบบทแล้วครับ วันนี้คุณใช้ Go straight, Turn left, Turn right และเชื่อมคำสั่งสองขั้นด้วย then ครับ'),
  ],
  fnd_v7_please_and_thank_you: [
    task('สวัสดีครับ 👋 วันนี้เราจะฝึกคำสุภาพที่ใช้ได้ทุกวัน ถ้าต้องการน้ำ ลองขออย่างสุภาพว่า “Water, please.”', 'Water, please.'),
    task('เมื่อมีคนช่วยเรา ใช้ Thank you แปลว่าขอบคุณครับ ลองพูด Thank you', 'Thank you'),
    task('คุณถือของหนัก เพื่อนช่วยเปิดประตูให้แล้วครับ คุณจะพูดอะไรกับเพื่อน', 'Thank you', ['Please', 'Thank you']),
    task('Sorry ใช้ขอโทษเมื่อเราทำผิด เช่นเดินชนคนโดยไม่ตั้งใจครับ ลองพูด Sorry', 'Sorry'),
    task('ระหว่างเดินออกจากห้อง คุณเผลอชนเพื่อนครับ จะพูดอะไรกับเขา', 'Sorry', ['Thank you', 'Sorry', 'Please']),
    task('ถ้าจะเรียกความสนใจก่อนเริ่มพูด ใช้ Excuse me ครับ ไม่ต้องรอให้ทำผิด ลองพูด Excuse me', 'Excuse me'),
    task('คุณอยากเรียกพนักงานที่ยังไม่เห็นคุณ จะเริ่มทักเขาอย่างสุภาพว่าอะไรครับ', 'Excuse me'),
    finish('จบบทแล้วครับ วันนี้ฝึก Please สำหรับคำขอ Thank you เมื่อได้รับความช่วยเหลือ Sorry เมื่อทำผิด และ Excuse me ก่อนเริ่มทักครับ'),
  ],
  fnd_v7_say_that_again: [
    task('เคยฟังภาษาอังกฤษแล้วไม่ทันไหมครับ? วันนี้เราจะฝึกขอให้อีกฝ่ายพูดซ้ำ พูดช้าลง และบอกเมื่อยังไม่เข้าใจ ไม่ต้องเดาครับ เริ่มด้วย “Please say that again.” ลองพูดตามครับ', 'Please say that again'),
    task('ถ้าอีกฝ่ายพูดเร็ว ขอให้ช้าลงด้วย Please speak slowly ครับ ลองพูดตาม', 'Please speak slowly'),
    task('อีกฝ่ายกำลังพูดเร็วมาก คุณอยากให้เขาลดความเร็ว จะขออย่างไรครับ', 'Please speak slowly', ['Please say that again', 'Please speak slowly']),
    task('ถ้ายังไม่เข้าใจ บอกได้ว่า I do not understand ครับ ลองพูดตาม', 'I do not understand'),
    task('ได้ยินชัดแล้ว แต่ยังไม่เข้าใจความหมายครับ จะบอกอีกฝ่ายอย่างไร', 'I do not understand', ['Please speak slowly', 'I do not understand']),
    task('ลองคุยจริงกันครับ สมมติครูเพิ่งบอกชื่อ แต่คุณฟังชื่อไม่ทัน ขอให้ครูพูดอีกครั้งโดยไม่ดูตัวช่วยครับ', 'Please say that again'),
    finish('ครูพูดซ้ำว่า My name is Teacher B. ชื่อของครูคือ Teacher B ครับ จบบทแล้วครับ คุณได้ฝึกขอซ้ำ ขอช้า และบอกว่าไม่เข้าใจ เวลาเจอสถานการณ์นี้ใช้วลีเหล่านี้ช่วยตัวเองได้ครับ'),
  ],
  fnd_v7_prices_and_paying: [
    task('สวัสดีครับ วันนี้เราจะฝึกซื้อตั๋ว ถามราคา และจ่ายเงินเป็นภาษาอังกฤษครับ 🎫 ticket คือตั๋ว เริ่มด้วยการขอตั๋วหนึ่งใบอย่างสุภาพว่า “One ticket, please.” ลองพูดตามครับ', 'One ticket, please'),
    task('อยากรู้ราคา ถามว่า How much is it? แปลว่าราคาเท่าไหร่ครับ ลองพูดตาม', 'How much is it?'),
    task('baht คือบาทครับ Thirty baht คือสามสิบบาท ถ้าราคาสี่สิบบาท พูดเป็นประโยคว่า It is forty baht ลองพูดประโยคนี้ครับ', 'It is forty baht'),
    task('ลองอ่านป้ายราคาใหม่ครับ 🏷️ 30 บาท บอกราคาโดยเริ่มด้วย It is … baht ครับ', 'It is thirty baht', ['thirty baht', 'forty baht'], 'It is '),
    task('ตอนยื่นเงินให้อีกฝ่าย พูดว่า Here you are ครับ ลองพูดตาม', 'Here you are'),
    task('ลองซื้อตั๋วกันครับ คุณอยู่หน้าเคาน์เตอร์และต้องการตั๋วหนึ่งใบ เริ่มขอตั๋วกับพนักงานครับ', 'One ticket, please'),
    task('พนักงานหยิบตั๋วให้ดูแล้ว แต่ยังไม่ได้บอกราคาครับ ลองถามราคาต่อได้เลย', 'How much is it?'),
    task('พนักงานตอบว่า It is forty baht. คุณเตรียมเงินพอดีและกำลังยื่นให้เขาครับ ตอนส่งเงินจะพูดว่าอะไร', 'Here you are'),
    finish('พนักงานรับเงินและส่งตั๋วให้ พร้อมพูด Thank you. จบบทแล้วครับ วันนี้ฝึกขอตั๋ว ถามและฟังราคาเป็นบาท แล้วพูดตอนยื่นเงินครับ'),
  ],
  fnd_v7_numbers_0_10: [
    task('สวัสดีครับ 👋 วันนี้เราจะฝึกนับเลขเป็นภาษาอังกฤษกัน ศูนย์ถึงห้าคือ zero, one, two, three, four, five ลองนับแอปเปิลแล้วพูดจำนวนเป็นภาษาอังกฤษครับ 🍎🍎🍎🍎', 'four', ['zero', 'three', 'four', 'five']),
    task('ต่อไปหกถึงสิบครับ six, seven, eight, nine, ten บัตรคิวของคุณคือเลข 7 🎫 ลองอ่านเลขคิวเป็นอังกฤษครับ', 'seven', ['six', 'seven', 'nine', 'ten']),
    task('ถึงห้องแล้วครับ 🚪 8 ห้องนี้เลขอะไร พูดเป็นอังกฤษครับ', 'eight', ['six', 'eight', 'nine', 'ten']),
    task('เลขศูนย์ถึงสิบ คุณชอบเลขไหนครับ เลือกเลขที่ชอบแล้วพูดได้เลย ไม่จำเป็นต้องเลือกจากตัวช่วยครับ', 'three', ['three', 'five', 'eight', 'ten'], '', true),
    finish('จบบทแล้วครับ วันนี้คุณได้ฝึกนับของ อ่านเลขคิว และเลขห้องครับ'),
  ],
  fnd_v7_eleven_to_twenty: [
    task('เลขเริ่มยาวขึ้นแล้วครับ แต่ยังไม่ต้องหยิบเครื่องคิดเลข 😄 วันนี้เราจะฝึกเลข 11–20 และนำไปใช้บอกอายุ สิบเอ็ดคือ eleven และสิบสองคือ twelve ลองพูด “twelve” ครับ', 'twelve'),
    task('สิบสาม thirteen สิบสี่ fourteen สิบห้า fifteen ครับ ลงท้ายด้วย teen ลองอ่านเลขห้อง 🚪 14 ครับ', 'fourteen', ['thirteen', 'fourteen', 'fifteen']),
    task('อีกห้องหนึ่งคือ 🚪 13 ลองอ่านเองครับ', 'thirteen', ['twelve', 'thirteen', 'fourteen']),
    task('สิบหกถึงสิบเก้าคือ sixteen, seventeen, eighteen, nineteen ครับ บัตรคิว 🎫 18 อ่านว่าอะไรครับ', 'eighteen', ['sixteen', 'seventeen', 'eighteen', 'nineteen']),
    task('ยี่สิบคือ twenty ครับ ลงท้ายด้วย ty ลองพูด twenty', 'twenty'),
    task('ใช้บอกอายุได้ด้วยครับ ฉันอายุสิบสองปี คือ I am twelve years old. ลองพูดตามครับ', 'I am twelve years old.'),
    task('สมมติว่าคุณอายุยี่สิบปี ลองบอกอายุด้วยรูป I am … years old. ครับ', 'I am twenty years old.'),
    finish('จบบทแล้วครับ วันนี้ฝึกอ่านเลขสิบเอ็ดถึงยี่สิบ และนำไปบอกอายุครับ'),
  ],
  fnd_v7_twenty_to_one_hundred: [
    task('รถเมล์กำลังมาแล้วครับ ถ้าอ่านเลขผิดอาจได้เที่ยวกรุงเทพฯ แบบไม่ได้ตั้งใจ 🚌😅 วันนี้เราจะฝึกอ่านหลักสิบจากราคา เลขรถเมล์ และเลขห้อง เริ่มจากยี่สิบ twenty สามสิบ thirty สี่สิบ forty และห้าสิบ fifty ลองพูด “forty” ครับ', 'forty'),
    task('ป้ายราคา 🏷️ 50 บาท ลองอ่านเฉพาะตัวเลขเป็นอังกฤษครับ', 'fifty', ['thirty', 'forty', 'fifty']),
    task('หกสิบถึงหนึ่งร้อยคือ sixty, seventy, eighty, ninety, one hundred ครับ ลองพูด eighty', 'eighty'),
    task('รถเมล์ 🚌 70 มาแล้วครับ ลองอ่านเลขสายเป็นอังกฤษ', 'seventy', ['sixty', 'seventy', 'eighty', 'ninety']),
    task('ประกอบเลขได้เลยครับ สามสิบห้าคือ thirty กับ five รวมเป็น thirty-five ลองพูด thirty-five ครับ', 'thirty-five'),
    task('ลองประกอบเลขใหม่ครับ 🚪 62 ห้องนี้เลขอะไร พูดเป็นอังกฤษได้เลย', 'sixty-two'),
    finish('จบบทแล้วครับ วันนี้ฝึกอ่านราคา เลขรถเมล์ และประกอบเลขสองหลักครับ'),
  ],
  fnd_v7_i_like_i_dont_like: [
    task('Teacher B ชอบกาแฟครับ แต่กล้วยน่าจะยังเป็นอันดับหนึ่ง ☕🍌 วันนี้เราจะฝึกบอกสิ่งที่ชอบและไม่ชอบ coffee คือกาแฟ ถ้าจะบอกว่า “ฉันชอบกาแฟ” พูดว่า “I like coffee.” ลองพูดตามครับ', 'I like coffee.'),
    task('tea คือชาครับ ถ้าคุณชอบชา จะพูดว่าอย่างไร ใช้ I like … ครับ', 'I like tea', ['tea', 'coffee'], 'I like '),
    task('ถ้าไม่ชอบ เติม don’t ครับ ฉันไม่ชอบชาคือ I don’t like tea. ลองพูดตามครับ', 'I don’t like tea.'),
    task('rice คือข้าว 🍚 และ water คือน้ำ 💧 ครับ ถ้าคุณชอบข้าว จะพูดว่าอย่างไร', 'I like rice', ['rice', 'water'], 'I like '),
    task('คราวนี้บอกสิ่งที่คุณชอบจริง ๆ ครับ ใช้ I like … เลือกได้ทุกคำ หรือบอกสิ่งอื่นที่คุณชอบได้เลย', 'I like coffee', ['coffee', 'tea', 'water', 'rice', 'noodles', 'bread'], 'I like ', true),
    finish('จบบทแล้วครับ วันนี้คุณได้ฝึกบอกว่าชอบและไม่ชอบอะไร ขอบคุณที่แบ่งปันครับ'),
  ],
};
